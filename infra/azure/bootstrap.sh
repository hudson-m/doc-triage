#!/usr/bin/env bash
# One-time Azure setup for doc-triage (ADR 11). Run by a person, not by CI:
# open Azure Cloud Shell (Bash) in the portal, upload this file, then `bash bootstrap.sh`.
#
# Creates, per environment (staging, production):
#   - a resource group with a Container Apps environment (Consumption, no Log Analytics)
#   - a container app that scales to zero (0.25 vCPU, 0.5 GiB, 0-1 replicas)
#   - an Entra app registration whose only credential is a GitHub OIDC federation for that
#     GitHub environment, with Contributor on that resource group only
# No client secret is created anywhere. Re-running is safe: existing resources are reused.
set -euo pipefail

REPO="${REPO:-hudson-m/doc-triage}"
LOCATION="${LOCATION:-brazilsouth}"
# Public placeholder until CD deploys the real image (the real app listens on 3000).
PLACEHOLDER_IMAGE="mcr.microsoft.com/k8se/quickstart:latest"

echo "Subscription: $(az account show --query name -o tsv)"
az provider register --namespace Microsoft.App --wait

declare -A client_ids
for env in staging production; do
  rg="rg-doc-triage-${env}"
  cae="cae-doc-triage-${env}"
  app="ca-doc-triage-${env}"
  echo "== ${env}"

  az group create --name "$rg" --location "$LOCATION" --output none

  if ! az containerapp env show --name "$cae" --resource-group "$rg" --output none 2>/dev/null; then
    az containerapp env create --name "$cae" --resource-group "$rg" --location "$LOCATION" \
      --logs-destination none --output none
  fi

  if ! az containerapp show --name "$app" --resource-group "$rg" --output none 2>/dev/null; then
    az containerapp create --name "$app" --resource-group "$rg" --environment "$cae" \
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

  # Object id + principal type skips a directory lookup that can fail right after creation.
  rg_id="$(az group show --name "$rg" --query id -o tsv)"
  sp_object_id="$(az ad sp show --id "$client_id" --query id -o tsv)"
  az role assignment create --assignee-object-id "$sp_object_id" \
    --assignee-principal-type ServicePrincipal --role Contributor --scope "$rg_id" --output none

  client_ids[$env]="$client_id"
done

echo
echo "Done. Send these values (none of them is a secret) to set the GitHub variables:"
echo "AZURE_TENANT_ID=$(az account show --query tenantId -o tsv)"
echo "AZURE_SUBSCRIPTION_ID=$(az account show --query id -o tsv)"
echo "staging    AZURE_CLIENT_ID=${client_ids[staging]}"
echo "production AZURE_CLIENT_ID=${client_ids[production]}"
