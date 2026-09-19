import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const yaml = readFileSync('.github/workflows/deploy-pages.yml', 'utf8');

describe('TKT-0009 AC #1 — triggers only on v* tag pushes', () => {
  it('declares a tags: v* trigger and no other event', () => {
    expect(yaml).toMatch(/tags:\s*\n\s*-\s*['"]v\*['"]/);
    expect(yaml).not.toMatch(/branches:/);
    expect(yaml).not.toMatch(/pull_request/);
    expect(yaml).not.toMatch(/workflow_dispatch/);
  });
});

describe('TKT-0009 AC #2 — BASE_PATH derived automatically', () => {
  it('sets BASE_PATH from a github repository context expression, not a literal', () => {
    expect(yaml).toMatch(/BASE_PATH:\s*\/\$\{\{\s*github\.(event\.repository\.name|repository)\s*\}\}\//);
  });
});

describe('TKT-0009 AC #3 — standard Pages actions, ephemeral token only', () => {
  it('uses configure-pages, upload-pages-artifact, and deploy-pages', () => {
    expect(yaml).toMatch(/uses:\s*actions\/configure-pages@/);
    expect(yaml).toMatch(/uses:\s*actions\/upload-pages-artifact@/);
    expect(yaml).toMatch(/uses:\s*actions\/deploy-pages@/);
  });

  it('grants pages: write and id-token: write, and references no repo secrets', () => {
    expect(yaml).toMatch(/pages:\s*write/);
    expect(yaml).toMatch(/id-token:\s*write/);
    expect(yaml).not.toMatch(/secrets\./);
  });
});

describe('TKT-0009 AC #4 — deploy skipped on failure, native notification only', () => {
  it('the deploy job depends on the build job', () => {
    expect(yaml).toMatch(/needs:\s*build/);
  });

  it('references no third-party notification action', () => {
    const usesLines = [...yaml.matchAll(/uses:\s*(\S+)/g)].map((m) => m[1]!);
    for (const action of usesLines) expect(action.toLowerCase()).not.toMatch(/slack|discord|webhook|mail/);
  });
});
