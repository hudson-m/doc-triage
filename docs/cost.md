# Cost

What this project uses, what it costs, and what could make it cost more. Checked against the
live subscription and the pricing pages on 2026-11-12; prices change, so re-check the links.

## What runs in Azure

| Resource                                                                                                           | Billing model                                                                                                                                                                                    | Expected cost       |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------- |
| Container Apps environment `cae-doc-triage` (Consumption profile only, no logs, not zone redundant)                | No charge for the environment or an unused Consumption profile; a fixed management fee applies only to Dedicated profiles, which we don't use                                                    | $0                  |
| Container apps `ca-doc-triage-staging` and `-production` (0.25 vCPU, 0.5 GiB, 0-1 replicas)                        | Per vCPU-second, GiB-second and request while a replica runs; nothing while scaled to zero. Free grant per subscription per month: 180,000 vCPU-seconds, 360,000 GiB-seconds, 2 million requests | $0 within the grant |
| Resource groups, Entra app registrations, federated credentials, RBAC role assignments, one custom Azure RBAC role | Not billed (workload identity federation is a free Entra feature)                                                                                                                                | $0                  |
| Outbound data to the internet                                                                                      | First 100 GB per month free                                                                                                                                                                      | $0                  |

The free grant is about **200 replica-hours a month** at 0.25 vCPU / 0.5 GiB, shared by both
apps. A demo that scales to zero between visits uses a small fraction of it.

## What would add cost

| Change                                        | Why it costs                                                   |
| --------------------------------------------- | -------------------------------------------------------------- |
| `--min-replicas 1` (no scale to zero)         | An always-on replica: ~2.6M vCPU-s a month, far over the grant |
| A Dedicated or Flexible workload profile      | Fixed management fee, and Flexible apps can't scale to zero    |
| Sending logs to Log Analytics / Azure Monitor | Billed per GB ingested and retained                            |
| An Azure Container Registry                   | Fixed daily price per registry, even when idle                 |
| `LLM_PROVIDER=anthropic` on a deployed app    | Anthropic API tokens, billed by Anthropic                      |
| An App Service plan                           | Billed per instance per hour, used or not                      |

## GitHub

The repository is public, so GitHub Actions on standard runners is free. Public GHCR packages
are free too; the image package must be switched to public after its first publish (it is
created private). For reference, a private repository on the Free plan gets:

| Item                           | Free plan allowance                                         | Note                         |
| ------------------------------ | ----------------------------------------------------------- | ---------------------------- |
| GitHub Actions                 | $12 of included compute a month (about 2,000 Linux minutes) | Unlimited for public repos   |
| GitHub Packages (GHCR) storage | 500 MB, shared with Actions artifacts                       | Public packages don't count  |
| GitHub Packages data transfer  | 1 GB a month                                                | Pulls by Actions don't count |

With the default $0 spending limit, going over a GitHub allowance blocks the usage instead of
billing it.

CodeRabbit (ADR 12) is free for public repositories.

## Guardrails

- A subscription budget with an email alert (for example, $1 a month) in Cost Management.
- Cost Management data lags 8 to 24 hours; check _Cost analysis_ grouped by service the day
  after a change.
- `infra/azure/bootstrap.sh` is the only thing that creates Azure resources, and it creates
  exactly the resources listed above.

## Sources

- [Azure Container Apps pricing](https://azure.microsoft.com/pricing/details/container-apps/)
- [Billing in Azure Container Apps](https://learn.microsoft.com/azure/container-apps/billing)
- [Workload profiles in Azure Container Apps](https://learn.microsoft.com/azure/container-apps/workload-profiles-overview)
- [Azure Container Apps plan types](https://learn.microsoft.com/azure/container-apps/plans)
- [Scaling in Azure Container Apps](https://learn.microsoft.com/azure/container-apps/scale-app)
- [Azure bandwidth pricing](https://azure.microsoft.com/pricing/details/bandwidth/)
- [Microsoft Entra Workload ID FAQ](https://learn.microsoft.com/entra/workload-id/workload-identities-faqs)
- [GitHub Packages billing](https://docs.github.com/billing/concepts/product-billing/github-packages)
- [Product usage included with each GitHub plan](https://docs.github.com/billing/reference/product-usage-included)
