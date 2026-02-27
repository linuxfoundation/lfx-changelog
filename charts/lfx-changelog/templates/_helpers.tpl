# Copyright The Linux Foundation and each contributor to LFX.
# SPDX-License-Identifier: MIT

{{/*
Expand the name of the chart.
*/}}
{{- define "lfx-changelog.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "lfx-changelog.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "lfx-changelog.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "lfx-changelog.labels" -}}
helm.sh/chart: {{ include "lfx-changelog.chart" . }}
{{ include "lfx-changelog.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- with .Values.labels }}
{{ toYaml . }}
{{- end }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "lfx-changelog.selectorLabels" -}}
app.kubernetes.io/name: {{ include "lfx-changelog.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "lfx-changelog.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "lfx-changelog.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Create the image name with tag
*/}}
{{- define "lfx-changelog.image" -}}
{{- $tag := .Values.image.tag | default .Chart.AppVersion }}
{{- printf "%s:%s" .Values.image.repository $tag }}
{{- end }}

{{/*
Common annotations
*/}}
{{- define "lfx-changelog.annotations" -}}
{{- with .Values.annotations }}
{{ toYaml . }}
{{- end }}
{{- end }}

{{/*
Pod annotations
*/}}
{{- define "lfx-changelog.podAnnotations" -}}
{{- with .Values.podAnnotations }}
{{ toYaml . }}
{{- end }}
{{- with .Values.annotations }}
{{ toYaml . }}
{{- end }}
{{- end }}

{{/*
Create the name of the external secrets secretstore to use
*/}}
{{- define "lfx-changelog.secretStoreName" -}}
{{- default (include "lfx-changelog.fullname" .) .Values.externalSecrets.secretStore.name }}
{{- end }}

{{/*
Create the name of the external secret to use
*/}}
{{- define "lfx-changelog.externalSecretName" -}}
{{- default (include "lfx-changelog.fullname" .) .Values.externalSecrets.name }}
{{- end }}

{{/*
SecretStore annotations
Merges global annotations with externalSecrets.secretStore.annotations
SecretStore-specific annotations override global ones on key conflicts
*/}}
{{- define "lfx-changelog.secretStoreAnnotations" -}}
{{- $notations := dict -}}
{{- if .Values.annotations }}
{{- $notations = merge $notations .Values.annotations }}
{{- end }}
{{- if .Values.externalSecrets.secretStore }}
{{- if .Values.externalSecrets.secretStore.annotations }}
{{- /* secretStore annotations override global on key conflicts */ -}}
{{- $notations = merge $notations .Values.externalSecrets.secretStore.annotations }}
{{- end }}
{{- end }}
{{- if $notations }}
{{- toYaml $notations }}
{{- end }}
{{- end }}

{{/*
ExternalSecret annotations
Merges global annotations with externalSecrets.annotations
ExternalSecret-specific annotations override global ones on key conflicts
*/}}
{{- define "lfx-changelog.externalSecretAnnotations" -}}
{{- $notations := dict -}}
{{- if .Values.annotations }}
{{- $notations = merge $notations .Values.annotations }}
{{- end }}
{{- if .Values.externalSecrets.annotations }}
{{- /* externalSecrets annotations override global on key conflicts */ -}}
{{- $notations = merge $notations .Values.externalSecrets.annotations }}
{{- end }}
{{- if $notations }}
{{- toYaml $notations }}
{{- end }}
{{- end }}
