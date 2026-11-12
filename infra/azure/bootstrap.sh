#!/usr/bin/env bash
# One-time Azure setup for doc-triage (ADR 11). Run by a person, not by CI, after
# `az login` with MFA (locally or in Azure Cloud Shell): `bash infra/azure/bootstrap.sh`.
#
# Creates:
#   - rg-doc-triage-shared: one Container Apps environment (Consumption, no Log Analytics).
#     New subscriptions may hold a single environment, so staging and production share it.
#   - a custom role that only allows joining that environment.
#   - per environment (staging, production): a resource group with a container app that scales
#     to zero (0.25 vCPU, 0.5 GiB, 0-1 replicas), and an Entra app registration whose only
#     credential is a GitHub OIDC federation for that GitHub environment. It gets Contributor on
#     its own resource group and the join role on the shared environment, nothing else.
# No client secret is created anywhere. Re-running is safe: existing resources are reused.
set -euo pipefail

REPO="${REPO:-hudson-m/doc-triage}"
LOCATION="${LOCATION:-brazilsouth}"
SHARED_RG="rg-doc-triage-shared"
CAE="cae-doc-triage"
JOIN_ROLE="Container Apps Environment Joiner (doc-triage)"
# Public placeholder until CD deploys the real image (the real app listens on 3000).
PLACEHOLDER_IMAGE="mcr.microsoft.com/k8se/quickstart:latest"

subscription_id="$(az account show --query id -o tsv)"
echo "Subscription: $(az account show --query name -o tsv)"
az provider register --namespace Microsoft.App --wait

echo "== shared environment"
az group create --name "$SHARED_RG" --location "$LOCATION" --output none
if ! az containerapp env show --name "$CAE" --resource-group "$SHARED_RG" --output none 2>/dev/null; then
  az containerapp env create --name "$CAE" --resource-group "$SHARED_RG" --location "$LOCATION" \
    --logs-destination none --output none
fi
cae_id="$(az containerapp env show --name "$CAE" --resource-group "$SHARED_RG" --query id -o tsv)"

# Least privilege on the shared environment: deploy into it, nothing else.
if [[ -z "$(az role definition list --name "$JOIN_ROLE" --query '[0].name' -o tsv)" ]]; then
  az role definition create --output none --role-definition "{
    \"Name\": \"${JOIN_ROLE}\",
    \"Description\": \"Read and join the doc-triage Container Apps environment.\",
    \"Actions\": [\"Microsoft.App/managedEnvironments/read\", \"Microsoft.App/managedEnvironments/join/action\"],
    \"AssignableScopes\": [\"/subscriptions/${subscription_id}/resourceGroups/${SHARED_RG}\"]
  }"
fi

# New role definitions and service principals take a moment to replicate.
assign_role() {
  local object_id="$1" role="$2" scope="$3"
  for attempt in 1 2 3 4 5 6; do
    if az role assignment create --assignee-object-id "$object_id" \
      --assignee-principal-type ServicePrincipal --role "$role" --scope "$scope" --output none; then
      return 0
    fi
    echo "Role assignment not ready (attempt ${attempt}); retrying in 10s..."
    sleep 10
  done
  return 1
}

declare -A client_ids
for env in staging production; do
  rg="rg-doc-triage-${env}"
  app="ca-doc-triage-${env}"
  echo "== ${env}"

  az group create --name "$rg" --location "$LOCATION" --output none

  if ! az containerapp show --name "$app" --resource-group "$rg" --output none 2>/dev/null; then
    az containerapp create --name "$app" --resource-group "$rg" --environment "$cae_id" \
      --image "$PLACEHOLDER_IMAGE" --ingress external --target-port 3000 \
      --cpu 0.25 --memory 0.5Gi --min-replicas 0 --max-replicas 1 \
      --env-vars LLM_PROVIDER=fake --output none
  fi

  display_name="github-doc-triage-${env}"
  client_id="$(az ad app list --display-name "$display_name" --query '[0].appId' -o tsv)"
  if [[ -z "$client_id" ]]; then
    client_id="$(az ad app create --display-name "$display_name" --query appId -o tsv)"
    az ad sp create --id "$client_id" --output none
  fi

  # Trust tokens GitHub issues for this repository AND this environment only.
  if [[ -z "$(az ad app federated-credential list --id "$client_id" --query "[?name=='github-${env}'].name" -o tsv)" ]]; then
    az ad app federated-credential create --id "$client_id" --parameters "{
      \"name\": \"github-${env}\",
      \"issuer\": \"https://token.actions.githubusercontent.com\",
      \"subject\": \"repo:${REPO}:environment:${env}\",
      \"audiences\": [\"api://AzureADTokenExchange\"]
    }" --output none
  fi

  sp_object_id="$(az ad sp show --id "$client_id" --query id -o tsv)"
  assign_role "$sp_object_id" Contributor "$(az group show --name "$rg" --query id -o tsv)"
  assign_role "$sp_object_id" "$JOIN_ROLE" "$cae_id"

  client_ids[$env]="$client_id"
done

echo
echo "Done. These values are identifiers, not secrets; set them as GitHub variables:"
echo "AZURE_TENANT_ID=$(az account show --query tenantId -o tsv)"
echo "AZURE_SUBSCRIPTION_ID=${subscription_id}"
echo "staging    AZURE_CLIENT_ID=${client_ids[staging]}"
echo "production AZURE_CLIENT_ID=${client_ids[production]}"
