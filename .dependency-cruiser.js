/** @type {import('dependency-cruiser').IConfiguration} */
export default {
  forbidden: [
    {
      name: 'domain-imports-nothing',
      comment: 'domain must have zero external/inner imports (docs/PROJECT-BRIEF.md §4)',
      severity: 'error',
      from: { path: '^src/features/[^/]+/domain' },
      to: {
        path: '^src/features/[^/]+/(application|infrastructure|ui)',
      },
    },
    {
      name: 'application-imports-only-domain',
      comment: 'application may only import its own domain',
      severity: 'error',
      from: { path: '^src/features/([^/]+)/application' },
      to: {
        path: '^src/features/([^/]+)/(infrastructure|ui)',
      },
    },
    {
      name: 'ui-and-infrastructure-are-siblings',
      comment: 'ui and infrastructure are both outer-ring details; neither imports the other',
      severity: 'error',
      from: { path: '^src/features/([^/]+)/ui' },
      to: { path: '^src/features/([^/]+)/infrastructure' },
    },
    {
      name: 'infrastructure-does-not-import-ui',
      severity: 'error',
      from: { path: '^src/features/([^/]+)/infrastructure' },
      to: { path: '^src/features/([^/]+)/ui' },
    },
    {
      name: 'no-cross-feature-imports',
      comment: 'features are independent verticals; cross-feature imports break screaming architecture',
      severity: 'error',
      from: { path: '^src/features/([^/]+)/' },
      to: {
        path: '^src/features/([^/]+)/',
        pathNot: '^src/features/$1/',
      },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
    },
    reporterOptions: {
      dot: {
        collapsePattern: '^src/features/[^/]+',
      },
    },
  },
};
