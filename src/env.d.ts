/// <reference path="../.astro/types.d.ts" />
/// <reference types="@cloudflare/workers-types" />

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

declare namespace App {
  interface Locals extends Runtime {
    session: {
      githubLogin: string;
      githubId: number;
      createdAt: number;
    } | null;
    sessionId: string | null;
  }
}

interface Env {
  SESSION: KVNamespace;
  GITHUB_TOKEN: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
}

declare const env: Env;
