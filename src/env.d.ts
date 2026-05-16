/// <reference path="../.astro/types.d.ts" />

declare namespace App {
  interface Locals {
    session: {
      githubLogin: string;
      githubId: number;
      createdAt: number;
    } | null;
    sessionId: string | null;
  }
}
