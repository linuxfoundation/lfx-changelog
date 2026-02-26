import { Routes } from '@angular/router';

import { authGuard } from '@shared/guards/auth.guard';

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
        path: 'entry/:id',
        loadComponent: () => import('@modules/public/changelog-detail/changelog-detail.component').then((m) => m.ChangelogDetailComponent),
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
        path: 'users',
        loadComponent: () => import('@modules/admin/user-management/user-management.component').then((m) => m.UserManagementComponent),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
