#!/usr/bin/env bash
# One-time set-up: Cloud Run updates itself whenever the service code on
# GitHub changes (no more running deploy-cloud-run.sh after each fix).
#
# Before running it, connect the GitHub repository once in the console:
#   Cloud Build -> Repositories (1st gen) / Triggers -> "Connect repository"
#   -> GitHub (Cloud Build GitHub App) -> Mokshagna-Nare/Atlas-Classes-Final.
#
# Then, in Cloud Shell:
#   cd ~/Atlas-Classes-Final && git pull && cd qpg-service && bash setup-auto-deploy.sh
set -euo pipefail

OWNER="Mokshagna-Nare"
REPO="Atlas-Classes-Final"
BRANCH="feature/mathtype-support"
TRIGGER="atlas-questions-generator-auto-deploy"

PROJECT="$(gcloud config get-value project 2>/dev/null || true)"
if [ -z "$PROJECT" ] || [ "$PROJECT" = "(unset)" ]; then
  read -rp "Google Cloud project ID: " PROJECT
  gcloud config set project "$PROJECT"
fi
NUMBER="$(gcloud projects describe "$PROJECT" --format 'value(projectNumber)')"
BUILDER="${NUMBER}-compute@developer.gserviceaccount.com"
echo "Project: $PROJECT"

gcloud services enable cloudbuild.googleapis.com run.googleapis.com artifactregistry.googleapis.com

echo "Allowing the build account to build images and update the Cloud Run service..."
for role in roles/run.admin roles/iam.serviceAccountUser roles/artifactregistry.writer roles/logging.logWriter roles/run.builder; do
  gcloud projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:$BUILDER" \
    --role "$role" --condition None >/dev/null
done

if gcloud builds triggers describe "$TRIGGER" >/dev/null 2>&1; then
  echo "The auto-deploy trigger already exists."
else
  echo "Creating the auto-deploy trigger..."
  if ! gcloud builds triggers create github \
      --name "$TRIGGER" \
      --repo-owner "$OWNER" \
      --repo-name "$REPO" \
      --branch-pattern "^${BRANCH}\$" \
      --build-config qpg-service/cloudbuild.yaml \
      --included-files 'qpg-service/**' \
      --service-account "projects/${PROJECT}/serviceAccounts/${BUILDER}"; then
    echo
    echo "Couldn't create the trigger. Most likely the GitHub repository isn't connected yet:"
    echo "Cloud Build -> Triggers -> Connect repository -> GitHub -> ${OWNER}/${REPO}, then run this again."
    exit 1
  fi
fi

echo "Deploying the latest code now (5-10 minutes; you can close this and watch Cloud Build -> History)..."
gcloud builds triggers run "$TRIGGER" --branch "$BRANCH" >/dev/null
echo
echo "Done. From now on every push to ${BRANCH} that changes qpg-service/ updates Cloud Run by itself."
echo "Progress and results: Cloud Build -> History."
