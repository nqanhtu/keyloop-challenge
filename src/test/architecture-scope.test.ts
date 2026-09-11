import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  checkDesignOnlyBackendDependencyViolation,
  checkDesignOnlyBackendImportViolation,
  checkDesignOnlyInfrastructurePaths,
  checkDesignOnlySyncSchedulerViolation,
  listScannedSourceFiles,
} from './architecture-checks';

/**
 * T08 scope proof (ARCH-SCOPE-001).
 *
 * System Design 7.2 and non-negotiable 10: the production backend
 * (Node.js/Fastify/Prisma/PostgreSQL), synchronization worker, identity
 * provider, and observability backend are design-only. This is an independent
 * mechanical check that they were not implemented, with allowed and forbidden
 * cases.
 */
describe('T08 Design-Only Production Backend & Infrastructure Proof (ARCH-SCOPE-001)', () => {
  const srcDir = path.resolve(__dirname, '..');
  const repositoryRoot = path.resolve(srcDir, '..');
  const scannedFiles = listScannedSourceFiles(srcDir);

  it('implements no design-only production backend import in any scanned source file', () => {
    expect(scannedFiles.length).toBeGreaterThan(0);
    for (const file of scannedFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const relativePath = path.relative(repositoryRoot, file);
      expect(
        checkDesignOnlyBackendImportViolation(content),
        `${relativePath} implements design-only production infrastructure`,
      ).toBeNull();
    }
  });

  it('implements no design-only synchronization scheduler or worker registration', () => {
    expect(scannedFiles.length).toBeGreaterThan(0);
    for (const file of scannedFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const relativePath = path.relative(repositoryRoot, file);
      expect(
        checkDesignOnlySyncSchedulerViolation(content),
        `${relativePath} registers a design-only synchronization scheduler or worker`,
      ).toBeNull();
    }
  });

  it('declares no design-only production backend dependency in package.json', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.resolve(repositoryRoot, 'package.json'), 'utf-8'),
    ) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
    };

    const declared = {
      ...manifest.dependencies,
      ...manifest.devDependencies,
      ...manifest.optionalDependencies,
    };

    expect(checkDesignOnlyBackendDependencyViolation(declared)).toBeNull();
  });

  it('adds no design-only production infrastructure paths', () => {
    expect(checkDesignOnlyInfrastructurePaths(repositoryRoot)).toBeNull();
  });

  describe('negative fixtures (the scope check must reject a violation)', () => {
    it('rejects a Fastify production server import', () => {
      const violation = checkDesignOnlyBackendImportViolation("import Fastify from 'fastify';");
      expect(violation).not.toBeNull();
      expect(violation).toContain('Fastify');
    });

    it('rejects a Prisma database client import', () => {
      const violation = checkDesignOnlyBackendImportViolation(
        "import { PrismaClient } from '@prisma/client';",
      );
      expect(violation).not.toBeNull();
      expect(violation).toContain('Prisma');
    });

    it('rejects a PostgreSQL driver import', () => {
      const violation = checkDesignOnlyBackendImportViolation("import { Pool } from 'pg';");
      expect(violation).not.toBeNull();
      expect(violation).toContain('PostgreSQL');
    });

    it('rejects a synchronization worker import', () => {
      const violation = checkDesignOnlyBackendImportViolation("import { Worker } from 'bullmq';");
      expect(violation).not.toBeNull();
      expect(violation).toContain('synchronization worker');
    });

    it('rejects a node-cron scheduler import', () => {
      const violation = checkDesignOnlyBackendImportViolation("import cron from 'node-cron';");
      expect(violation).not.toBeNull();
      expect(violation).toContain('scheduler');
    });

    it('rejects cron, node-schedule, croner, and bree scheduler imports', () => {
      for (const specifier of ['cron', 'node-schedule', 'croner', 'bree']) {
        const violation = checkDesignOnlyBackendImportViolation(`import scheduler from '${specifier}';`);
        expect(violation, `${specifier} should be rejected`).not.toBeNull();
        expect(violation).toContain('scheduler');
      }
    });

    it('rejects a node:worker_threads Worker import', () => {
      const violation = checkDesignOnlyBackendImportViolation(
        "import { Worker } from 'node:worker_threads';",
      );
      expect(violation).not.toBeNull();
      expect(violation).toContain('worker thread');
    });

    it('rejects a design-only synchronization interval scheduler', () => {
      const violation = checkDesignOnlySyncSchedulerViolation(
        'setInterval(() => syncInventory(), 60000);',
      );
      expect(violation).not.toBeNull();
      expect(violation).toContain('scheduler');
    });

    it('rejects a cron.schedule registration', () => {
      const violation = checkDesignOnlySyncSchedulerViolation(
        "cron.schedule('*/5 * * * *', syncInventory);",
      );
      expect(violation).not.toBeNull();
      expect(violation).toContain('scheduler');
    });

    it('rejects a worker-thread construction', () => {
      const violation = checkDesignOnlySyncSchedulerViolation(
        "const worker = new Worker('./sync-worker.js');",
      );
      expect(violation).not.toBeNull();
      expect(violation).toContain('worker thread');
    });

    it('rejects an identity provider import', () => {
      const violation = checkDesignOnlyBackendImportViolation(
        "import { auth } from 'express-openid-connect';",
      );
      expect(violation).not.toBeNull();
      expect(violation).toContain('identity provider');
    });

    it('rejects an observability backend import', () => {
      const violation = checkDesignOnlyBackendImportViolation(
        "import * as Sentry from '@sentry/node';",
      );
      expect(violation).not.toBeNull();
      expect(violation).toContain('observability backend');
    });

    it('rejects a dynamic import of a design-only backend module', () => {
      const violation = checkDesignOnlyBackendImportViolation(
        "const { Pool } = await import('pg');",
      );
      expect(violation).not.toBeNull();
    });

    it('rejects design-only production dependencies declared in a manifest', () => {
      const violation = checkDesignOnlyBackendDependencyViolation({
        react: '^19.3.0',
        fastify: '^5.0.0',
        '@prisma/client': '^6.0.0',
        pg: '^8.0.0',
      });
      expect(violation).not.toBeNull();
      expect(violation).toContain('Fastify');
    });

    it('rejects design-only production infrastructure paths on disk', () => {
      const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 't08-scope-'));
      try {
        fs.mkdirSync(path.join(temporaryRoot, 'prisma'));
        fs.writeFileSync(path.join(temporaryRoot, 'prisma', 'schema.prisma'), 'datasource db {}\n');
        expect(checkDesignOnlyInfrastructurePaths(temporaryRoot)).not.toBeNull();
      } finally {
        fs.rmSync(temporaryRoot, { recursive: true, force: true });
      }
    });

    it('rejects a worker/jobs/sync infrastructure path on disk', () => {
      const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 't08-scope-sync-'));
      try {
        fs.mkdirSync(path.join(temporaryRoot, 'src', 'workers'), { recursive: true });
        fs.writeFileSync(
          path.join(temporaryRoot, 'src', 'workers', 'sync-worker.ts'),
          'export const worker = true;\n',
        );
        const violation = checkDesignOnlyInfrastructurePaths(temporaryRoot);
        expect(violation).not.toBeNull();
        expect(violation).toContain('src/workers');
      } finally {
        fs.rmSync(temporaryRoot, { recursive: true, force: true });
      }
    });

    it('scans a new infrastructure root rather than only the frontend roots', () => {
      const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 't08-scope-root-'));
      try {
        const temporarySrc = path.join(temporaryRoot, 'src');
        fs.mkdirSync(path.join(temporarySrc, 'workers'), { recursive: true });
        const workerFile = path.join(temporarySrc, 'workers', 'sync-worker.ts');
        fs.writeFileSync(
          workerFile,
          "import cron from 'node-cron';\nsetInterval(() => syncInventory(), 60000);\n",
        );

        const scanned = listScannedSourceFiles(temporarySrc);
        expect(scanned).toContain(workerFile);

        const content = fs.readFileSync(workerFile, 'utf-8');
        expect(checkDesignOnlyBackendImportViolation(content)).not.toBeNull();
        expect(checkDesignOnlySyncSchedulerViolation(content)).not.toBeNull();
      } finally {
        fs.rmSync(temporaryRoot, { recursive: true, force: true });
      }
    });
  });

  describe('positive cases (compliant frontend-only code must pass)', () => {
    it('accepts a frontend file that only uses the HTTP/API boundary', () => {
      const positive = [
        "import { apiClient } from '../../api';",
        "export const loadInventory = () => apiClient.get('/vehicles');",
      ].join('\n');
      expect(checkDesignOnlyBackendImportViolation(positive)).toBeNull();
    });

    it('accepts an unrelated frontend timeout with no synchronization callback', () => {
      const positive = 'setTimeout(() => setFilterSheetOpen(false), 150);';
      expect(checkDesignOnlySyncSchedulerViolation(positive)).toBeNull();
    });

    it('accepts a manifest that declares only the frontend and mock stack', () => {
      const violation = checkDesignOnlyBackendDependencyViolation({
        react: '^19.3.0',
        '@tanstack/react-query': '^5.102.8',
        msw: '^2.15.0',
      });
      expect(violation).toBeNull();
    });

    it('accepts a repository root without design-only infrastructure paths', () => {
      const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 't08-scope-ok-'));
      try {
        fs.mkdirSync(path.join(temporaryRoot, 'src'));
        fs.writeFileSync(path.join(temporaryRoot, 'package.json'), '{}\n');
        expect(checkDesignOnlyInfrastructurePaths(temporaryRoot)).toBeNull();
      } finally {
        fs.rmSync(temporaryRoot, { recursive: true, force: true });
      }
    });
  });
});
