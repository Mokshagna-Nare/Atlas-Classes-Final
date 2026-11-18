#!/usr/bin/env bash
# Deploys the Questions generator service to Google Cloud Run.
#
# Run it in Google Cloud Shell (console.cloud.google.com -> the ">_" icon):
#
#   git clone -b feature/mathtype-support https://github.com/Mokshagna-Nare/Atlas-Classes-Final.git
#   cd Atlas-Classes-Final/qpg-service
#   bash deploy-cloud-run.sh
#
# Re-run the same command to deploy an update (settings and keys are kept
# unless you type new ones). Render stays untouched as a fallback.
set -euo pipefail

SERVICE="atlas-questions-generator"
REGION="${REGION:-us-central1}"   # a Tier 1 region: full monthly free allowance
ORIGINS="https://atlasclasses.com,https://www.atlasclasses.com"

PROJECT="$(gcloud config get-value project 2>/dev/null || true)"
if [ -z "$PROJECT" ] || [ "$PROJECT" = "(unset)" ]; then
  read -rp "Google Cloud project ID: " PROJECT
  gcloud config set project "$PROJECT"
fi
echo "Project: $PROJECT   Region: $REGION   Service: $SERVICE"

echo "Enabling Cloud Run, Cloud Build and Artifact Registry (first time only)..."
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com

# New projects build with the default compute service account, which may lack
# the rights to build from source ("PERMISSION_DENIED" during the build).
# Grant it the Cloud Run Builder role; harmless if it already has it.
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT" --format 'value(projectNumber)' 2>/dev/null || true)"
if [ -n "$PROJECT_NUMBER" ]; then
  gcloud projects add-iam-policy-binding "$PROJECT" \
    --member "serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
    --role roles/run.builder --condition None >/dev/null 2>&1 \
    || echo "(Could not grant the build role automatically; continuing.)"
fi

EXISTS=0
if gcloud run services describe "$SERVICE" --region "$REGION" >/dev/null 2>&1; then
  EXISTS=1
fi

# Settings that are not secret.
ENV_VARS="QPG_LOW_MEMORY=0|QPG_ASYNC_JOBS=0|QPG_FAST_START=0|QPG_REQUIRE_MFA=1|QPG_ALLOWED_ROLES=admin|QPG_ALLOWED_ORIGINS=$ORIGINS"

ask() {  # ask NAME "question" [secret]
  local value=""
  if [ "${3:-}" = "secret" ]; then
    read -rsp "$2" value; echo
  else
    read -rp "$2" value
  fi
  if [ -n "$value" ]; then
    ENV_VARS="$ENV_VARS|$1=$value"
  fi
}

if [ "$EXISTS" = "0" ]; then
  echo "First deployment: enter the settings (same values as on Render)."
else
  echo "Updating the existing service. Press Enter to keep a current value."
fi
ask SUPABASE_URL      "SUPABASE_URL (e.g. https://xxxx.supabase.co): "
ask SUPABASE_ANON_KEY "SUPABASE_ANON_KEY: " secret
ask OMNIROUTE_API_KEY "OMNIROUTE_API_KEY (Enter to skip): " secret
ask OMNIROUTE_MODEL   "OMNIROUTE_MODEL (e.g. auto, Enter to skip): "
ask OMNIROUTE_FALLBACK_MODELS "OMNIROUTE_FALLBACK_MODELS (comma separated, Enter to skip): "
ask ANTHROPIC_API_KEY "ANTHROPIC_API_KEY (Enter to skip): " secret

# --update-env-vars keeps values that were set before and not re-entered.
ENV_FLAG="--update-env-vars"
[ "$EXISTS" = "0" ] && ENV_FLAG="--set-env-vars"

echo "Building and deploying (5-10 minutes; the build runs the self-test)..."
gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 1 \
  --timeout 3600 \
  --concurrency 4 \
  --min-instances 0 \
  --max-instances 1 \
  --cpu-boost \
  "$ENV_FLAG" "^|^$ENV_VARS"

URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format 'value(status.url)')"
echo
echo "Deployed: $URL"
echo "Checking $URL/health ..."
for attempt in 1 2 3 4 5 6; do
  if curl -fsS "$URL/health"; then echo; break; fi
  sleep 10
done
echo
echo "NEXT: send this address to Claude (or set VITE_QUESTIONS_GENERATOR_API=$URL"
echo "on the website's hosting and redeploy), so the admin panel uses Cloud Run."
