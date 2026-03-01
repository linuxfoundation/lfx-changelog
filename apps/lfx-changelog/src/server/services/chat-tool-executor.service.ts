// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { CHAT_CONFIG } from '../constants/chat.constants';
import { serverLogger } from '../server-logger';

import { ChangelogService } from './changelog.service';
import { ProductService } from './product.service';

import type { ChatAccessLevel, GetChangelogDetailToolArgs, OpenAIToolCall, SearchChangelogsToolArgs } from '@lfx-changelog/shared';

export class ChatToolExecutorService {
  private readonly productService = new ProductService();
  private readonly changelogService = new ChangelogService();

  public async execute(toolCall: OpenAIToolCall, accessLevel: ChatAccessLevel): Promise<string> {
    const { name, arguments: argsString } = toolCall.function;

    let parsedArgs: SearchChangelogsToolArgs | GetChangelogDetailToolArgs | Record<string, never> = {};
    try {
      parsedArgs = JSON.parse(argsString) as typeof parsedArgs;
    } catch {
      return JSON.stringify({ error: `Invalid JSON arguments for tool ${name}` });
    }

    serverLogger.info({ tool: name, args: parsedArgs, accessLevel }, 'Executing chat tool');

    try {
      switch (name) {
        case 'list_products':
          return await this.listProducts(accessLevel);
        case 'search_changelogs':
          return await this.searchChangelogs(parsedArgs as SearchChangelogsToolArgs, accessLevel);
        case 'get_changelog_detail':
          return await this.getChangelogDetail(parsedArgs as GetChangelogDetailToolArgs, accessLevel);
        default:
          return JSON.stringify({ error: `Unknown tool: ${name}` });
      }
    } catch (error) {
      serverLogger.error({ err: error, tool: name }, 'Chat tool execution failed');
      return JSON.stringify({ error: `Tool ${name} failed: ${(error as Error).message}` });
    }
  }

  private async listProducts(accessLevel: ChatAccessLevel): Promise<string> {
    const products = accessLevel === 'admin' ? await this.productService.findAll() : await this.productService.findAllPublic();

    const summary = products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
    }));

    return JSON.stringify({ products: summary, count: summary.length });
  }

  private async searchChangelogs(args: SearchChangelogsToolArgs, accessLevel: ChatAccessLevel): Promise<string> {
    const params = {
      productId: args.productId,
      status: accessLevel === 'admin' ? args.status : undefined,
      page: args.page || 1,
      limit: args.limit || 20,
    };

    const result = accessLevel === 'admin' ? await this.changelogService.findAll(params) : await this.changelogService.findPublished(params);

    const truncatedData = result.data.map((entry) => ({
      id: entry.id,
      title: entry.title,
      description: entry.description
        ? entry.description.slice(0, CHAT_CONFIG.DESCRIPTION_TRUNCATE_LENGTH) +
          (entry.description.length > CHAT_CONFIG.DESCRIPTION_TRUNCATE_LENGTH ? '...' : '')
        : null,
      version: entry.version,
      status: entry.status,
      publishedAt: entry.publishedAt,
      createdAt: entry.createdAt,
      product: 'product' in entry ? entry.product : undefined,
    }));

    return JSON.stringify({
      entries: truncatedData,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    });
  }

  private async getChangelogDetail(args: GetChangelogDetailToolArgs, accessLevel: ChatAccessLevel): Promise<string> {
    const entry = accessLevel === 'admin' ? await this.changelogService.findById(args.id) : await this.changelogService.findPublishedById(args.id);

    return JSON.stringify({
      id: entry.id,
      title: entry.title,
      description: entry.description,
      version: entry.version,
      status: entry.status,
      publishedAt: entry.publishedAt,
      createdAt: entry.createdAt,
      product: 'product' in entry ? entry.product : undefined,
    });
  }
}
