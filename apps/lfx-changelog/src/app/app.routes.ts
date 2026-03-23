// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { Routes } from '@angular/router';

import { authGuard } from '@shared/guards/auth.guard';
import { superAdminGuard } from '@shared/guards/super-admin.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('@app/layouts/public-layout/public-layout.component').then((m) => m.PublicLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () => import('@modules/public/changelog-feed/changelog-feed.component').then((m) => m.ChangelogFeedComponent),
      },
      {
        path: 'products/:slug',
        loadComponent: () => import('@modules/public/product-changelog/product-changelog.component').then((m) => m.ProductChangelogComponent),
      },
      {
        path: 'entry/:slug',
        loadComponent: () => import('@modules/public/changelog-detail/changelog-detail.component').then((m) => m.ChangelogDetailComponent),
      },
      {
        path: 'blog',
        loadComponent: () => import('@modules/public/blog-feed/blog-feed.component').then((m) => m.BlogFeedComponent),
      },
      {
        path: 'blog/:slug',
        loadComponent: () => import('@modules/public/blog-detail/blog-detail.component').then((m) => m.BlogDetailComponent),
      },
      {
        path: 'roadmap',
        loadComponent: () => import('@modules/public/roadmap/roadmap-board/roadmap-board.component').then((m) => m.RoadmapBoardComponent),
      },
      {
        path: 'chat',
        loadComponent: () => import('@modules/public/public-chat/public-chat.component').then((m) => m.PublicChatComponent),
      },
    ],
  },
  {
    path: 'admin',
    canActivate: [authGuard],
    loadComponent: () => import('@app/layouts/admin-layout/admin-layout.component').then((m) => m.AdminLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () => import('@modules/admin/admin-dashboard/admin-dashboard.component').then((m) => m.AdminDashboardComponent),
      },
      {
        path: 'blog',
        loadComponent: () => import('@modules/admin/blog-list/blog-list.component').then((m) => m.BlogListComponent),
      },
      {
        path: 'blog/new',
        loadComponent: () => import('@modules/admin/blog-editor/blog-editor.component').then((m) => m.BlogEditorComponent),
      },
      {
        path: 'blog/:id/edit',
        loadComponent: () => import('@modules/admin/blog-editor/blog-editor.component').then((m) => m.BlogEditorComponent),
      },
      {
        path: 'changelogs',
        loadComponent: () => import('@modules/admin/changelog-list/changelog-list.component').then((m) => m.ChangelogListComponent),
      },
      {
        path: 'changelogs/new',
        loadComponent: () => import('@modules/admin/changelog-editor/changelog-editor.component').then((m) => m.ChangelogEditorComponent),
      },
      {
        path: 'changelogs/:id/edit',
        loadComponent: () => import('@modules/admin/changelog-editor/changelog-editor.component').then((m) => m.ChangelogEditorComponent),
      },
      {
        path: 'products',
        loadComponent: () => import('@modules/admin/product-management/product-management.component').then((m) => m.ProductManagementComponent),
      },
      {
        path: 'products/:id',
        loadComponent: () => import('@modules/admin/product-detail/product-detail.component').then((m) => m.ProductDetailComponent),
      },
      {
        path: 'repositories',
        canActivate: [superAdminGuard],
        loadComponent: () => import('@modules/admin/repository-list/repository-list.component').then((m) => m.RepositoryListComponent),
      },
      {
        path: 'users',
        canActivate: [superAdminGuard],
        loadComponent: () => import('@modules/admin/user-management/user-management.component').then((m) => m.UserManagementComponent),
      },
      {
        path: 'agent-jobs',
        canActivate: [superAdminGuard],
        loadComponent: () => import('@modules/admin/agent-job-list/agent-job-list.component').then((m) => m.AgentJobListComponent),
      },
      {
        path: 'agent-jobs/:id',
        canActivate: [superAdminGuard],
        loadComponent: () => import('@modules/admin/agent-job-detail/agent-job-detail.component').then((m) => m.AgentJobDetailComponent),
      },
      {
        path: 'settings',
        loadComponent: () => import('@modules/admin/user-settings/user-settings.component').then((m) => m.UserSettingsComponent),
      },
      {
        path: 'chat',
        loadComponent: () => import('@modules/admin/admin-chat/admin-chat.component').then((m) => m.AdminChatComponent),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
