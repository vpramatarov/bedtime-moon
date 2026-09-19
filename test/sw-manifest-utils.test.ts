import { describe, it, expect } from 'vitest';
import { join, sep } from 'node:path';
import { toUrlPath, hashManifest, checkSizeBudget, withBasePath } from '../scripts/sw/manifest-utils.mjs';

describe('AC #3 — precache manifest utilities', () => {
  describe('toUrlPath', () => {
    it('produces a clean leading-slash URL from an absolute path under distRoot', () => {
      const distRoot = join('C:' + sep, 'app', 'dist');
      const abs = join(distRoot, 'assets', 'index.js');
      expect(toUrlPath(distRoot, abs)).toBe('/assets/index.js');
    });

    it('handles a file directly at the dist root', () => {
      const distRoot = join('C:' + sep, 'app', 'dist');
      const abs = join(distRoot, 'index.html');
      expect(toUrlPath(distRoot, abs)).toBe('/index.html');
    });
  });

  describe('hashManifest', () => {
    const fileA = { urlPath: '/a.js', bytes: Buffer.from('alpha') };
    const fileB = { urlPath: '/b.js', bytes: Buffer.from('beta') };

    it('is deterministic regardless of input order', () => {
      expect(hashManifest([fileA, fileB])).toBe(hashManifest([fileB, fileA]));
    });

    it('changes when any file\'s bytes change', () => {
      const changed = { urlPath: '/a.js', bytes: Buffer.from('ALPHA') };
      expect(hashManifest([changed, fileB])).not.toBe(hashManifest([fileA, fileB]));
    });

    it('changes when the set of urls changes, even with byte-identical content', () => {
      const renamed = { urlPath: '/c.js', bytes: Buffer.from('alpha') };
      expect(hashManifest([renamed, fileB])).not.toBe(hashManifest([fileA, fileB]));
    });

    it('does not change for an unchanged file set', () => {
      expect(hashManifest([fileA, fileB])).toBe(hashManifest([fileA, fileB]));
    });
  });

  describe('withBasePath (TKT-0007)', () => {
    it('is the identity function at the root base', () => {
      expect(withBasePath('/', '/frames/moon-00.webp')).toBe('/frames/moon-00.webp');
      expect(withBasePath('/', '/sw.js')).toBe('/sw.js');
    });

    it('prefixes a root-relative path with a non-root base', () => {
      expect(withBasePath('/base-test/', '/frames/moon-00.webp')).toBe('/base-test/frames/moon-00.webp');
      expect(withBasePath('/base-test/', '/icons/icon-192-maskable.png')).toBe(
        '/base-test/icons/icon-192-maskable.png',
      );
    });

    it('prefixes the manifest start_url path ("/") to exactly the base itself', () => {
      expect(withBasePath('/base-test/', '/')).toBe('/base-test/');
      expect(withBasePath('/', '/')).toBe('/');
    });
  });

  describe('checkSizeBudget', () => {
    const EIGHT_MIB = 8 * 1024 * 1024;

    it('throws when the total exceeds the budget', () => {
      expect(() => checkSizeBudget(EIGHT_MIB + 1, EIGHT_MIB)).toThrow();
    });

    it('passes silently at or under the budget', () => {
      expect(() => checkSizeBudget(EIGHT_MIB, EIGHT_MIB)).not.toThrow();
      expect(() => checkSizeBudget(1024, EIGHT_MIB)).not.toThrow();
    });
  });
});
