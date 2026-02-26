// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { appConfig } from './app/app.config';

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
