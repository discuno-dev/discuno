import pluginJs from '@eslint/js'
import pluginReact from 'eslint-plugin-react'
import pluginReactHooks from 'eslint-plugin-react-hooks'
// @ts-expect-error - plugin has no types
import pluginImport from 'eslint-plugin-import'
// @ts-expect-error - plugin has no types
import globals from 'globals'
import tseslint from 'typescript-eslint'
// @ts-expect-error - plugin has no types
import drizzle from 'eslint-plugin-drizzle'
// @ts-expect-error - plugin has no types
import pluginNext from '@next/eslint-plugin-next'

// =============================================================================
// REUSABLE RULE SETS (DRY Principle)
// =============================================================================

const TYPESCRIPT_UNSAFE_RULES = {
  '@typescript-eslint/no-unsafe-assignment': 'off',
  '@typescript-eslint/no-unsafe-member-access': 'off',
  '@typescript-eslint/no-unsafe-call': 'off',
  '@typescript-eslint/no-unsafe-return': 'off',
  '@typescript-eslint/no-unsafe-argument': 'off',
}

const RELAXED_TYPESCRIPT_RULES = {
  '@typescript-eslint/no-unused-vars': 'off',
  '@typescript-eslint/no-non-null-assertion': 'off',
  '@typescript-eslint/unbound-method': 'off',
  '@typescript-eslint/no-floating-promises': 'off',
  '@typescript-eslint/restrict-template-expressions': 'off',
  ...TYPESCRIPT_UNSAFE_RULES,
}

const CORE_TYPESCRIPT_RULES = {
  '@typescript-eslint/no-unused-vars': [
    'warn',
    {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_',
    },
  ],
  '@typescript-eslint/consistent-type-imports': [
    'warn',
    {
      prefer: 'type-imports',
      fixStyle: 'inline-type-imports',
    },
  ],
  '@typescript-eslint/no-misused-promises': [
    'error',
    {
      checksVoidReturn: {
        attributes: false,
      },
    },
  ],
  '@typescript-eslint/no-floating-promises': 'warn',
  '@typescript-eslint/prefer-nullish-coalescing': 'warn',
  '@typescript-eslint/no-unnecessary-condition': [
    'warn',
    {
      allowConstantLoopConditions: true,
    },
  ],
  '@typescript-eslint/no-non-null-assertion': 'warn',
  '@typescript-eslint/require-await': 'off',
  '@typescript-eslint/array-type': 'off',
  '@typescript-eslint/consistent-type-definitions': 'off',
  '@typescript-eslint/restrict-template-expressions': 'off',
  // Relaxed for development
  '@typescript-eslint/no-explicit-any': 'warn',
  ...TYPESCRIPT_UNSAFE_RULES,
}

const CORE_CODE_QUALITY_RULES = {
  'prefer-const': 'error',
  'no-var': 'error',
  'prefer-arrow-callback': 'error',
  'no-useless-escape': 'warn',
}

const TEST_RELAXED_RULES = {
  ...RELAXED_TYPESCRIPT_RULES,
  // Convert errors to warnings for test files
  'prefer-const': 'warn',
  'no-var': 'warn',
  'prefer-arrow-callback': 'warn',
  '@typescript-eslint/no-misused-promises': 'warn',
  // Keep these off for tests
  'no-unused-vars': 'off',
  'max-lines': 'off',
  'no-control-regex': 'off',
  'import/no-default-export': 'off',
}

const REACT_RULES = {
  ...pluginReact.configs.recommended.rules,
  ...pluginReact.configs['jsx-runtime'].rules,
  ...pluginReactHooks.configs.recommended.rules,
  // Modern React doesn't need these
  'react/jsx-uses-react': 'off',
  'react/react-in-jsx-scope': 'off',
  'react/prop-types': 'off',
}

// =============================================================================
// SHARED LANGUAGE OPTIONS
// =============================================================================

const TYPESCRIPT_LANGUAGE_OPTIONS = {
  parser: tseslint.parser,
  parserOptions: {
    projectService: {
      allowDefaultProject: ['*.js', '*.mjs', '*.cjs'],
    },
    tsconfigRootDir: import.meta.dirname,
  },
  globals: {
    ...globals.browser,
    ...globals.node,
    ...globals.es2022,
  },
}

const NODE_LANGUAGE_OPTIONS = {
  globals: {
    ...globals.node,
    ...globals.es2022,
  },
}

// =============================================================================
// FILE PATTERNS
// =============================================================================

const PATTERNS = {
  TYPESCRIPT: ['**/*.{ts,tsx,mts,cts}'],
  REACT: ['**/*.{jsx,tsx}'],
  JAVASCRIPT: ['**/*.{js,mjs,cjs}'],
  TESTS: [
    '**/*.test.{js,ts,jsx,tsx}',
    '**/*.spec.{js,ts,jsx,tsx}',
    '**/__tests__/**/*.{js,ts,jsx,tsx}',
    '**/test/**/*.{js,ts,jsx,tsx}',
    '**/tests/**/*.{js,ts,jsx,tsx}',
    '**/test-utils.{js,ts,jsx,tsx}',
    '**/vitest.setup.ts',
  ],
  CONFIGS: [
    '**/*.config.{js,ts,mjs,cjs}',
    '**/vitest.config.ts',
    '**/tsup.config.ts',
    '**/tailwind.config.{js,ts}',
    '**/drizzle.config.ts',
    '**/next.config.js',
    '**/turbo.json',
    '**/eslint.config.{js,mjs}',
  ],
  NEXTJS_SPECIAL: [
    'apps/web/drizzle.config.ts',
    'apps/web/next.config.js',
    'apps/web/src/middleware.ts',
    'apps/web/src/server/auth/index.ts',
    'apps/web/src/app/**/layout.{ts,tsx}',
    'apps/web/src/app/**/page.{ts,tsx}',
    'apps/web/src/app/**/error.{ts,tsx}',
    'apps/web/src/app/**/loading.{ts,tsx}',
    'apps/web/src/app/**/not-found.{ts,tsx}',
    'apps/web/src/app/**/template.{ts,tsx}',
    'apps/web/src/app/**/head.{ts,tsx}',
    'apps/web/src/app/**/default.tsx',
    'apps/web/src/app/global-error.tsx',
  ],
  ENV: ['**/env.js', '**/env.ts'],
  DISCUNO_ATOMS: {
    MAIN: ['packages/discuno-atoms/src/**/*.{ts,tsx}'],
    TESTS: [
      'packages/discuno-atoms/**/*.test.{ts,tsx}',
      'packages/discuno-atoms/**/*.spec.{ts,tsx}',
      'packages/discuno-atoms/**/__tests__/**/*.{ts,tsx}',
    ],
    CONFIGS: [
      'packages/discuno-atoms/*.config.{ts,js}',
      'packages/discuno-atoms/tsup.config.ts',
      'packages/discuno-atoms/vitest.config.ts',
      'packages/discuno-atoms/tailwind.config.ts',
    ],
  },
}

/** @type {import('eslint').Linter.Config[]} */
export default [
  // =============================================================================
  // GLOBAL IGNORES
  // =============================================================================
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/.turbo/**',
      '**/.changeset/**',
      '**/.git/**',
      '**/build/**',
      '**/*.tsbuildinfo',
      '**/.cache/**',
      '**/.husky/**',
      '**/public/**',
      '**/next-env.d.ts',
      '**/.commitlintrc.*',
      // Generated UI components excluded from tsconfig
      '**/src/components/ui/**',
    ],
  },

  // =============================================================================
  // BASE CONFIGURATIONS
  // =============================================================================
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  // =============================================================================
  // TYPESCRIPT FILES
  // =============================================================================
  {
    files: PATTERNS.TYPESCRIPT,
    languageOptions: TYPESCRIPT_LANGUAGE_OPTIONS,
    rules: {
      ...CORE_TYPESCRIPT_RULES,
      ...CORE_CODE_QUALITY_RULES,
    },
  },

  // =============================================================================
  // REACT FILES
  // =============================================================================
  {
    files: PATTERNS.REACT,
    plugins: {
      react: pluginReact,
      'react-hooks': pluginReactHooks,
    },
    settings: {
      react: {
        version: 'detect',
        jsxRuntime: 'automatic',
      },
    },
    rules: REACT_RULES,
  },

  // =============================================================================
  // NEXT.JS APP (apps/web)
  // =============================================================================
  {
    files: ['apps/web/**/*.{js,jsx,ts,tsx}'],
    plugins: {
      drizzle,
      import: pluginImport,
      '@next/next': pluginNext,
    },
    rules: {
      ...pluginNext.configs.recommended.rules,
      ...pluginNext.configs['core-web-vitals'].rules,
      'import/no-default-export': 'error',
      // Drizzle ORM safety rules
      'drizzle/enforce-delete-with-where': [
        'error',
        {
          drizzleObjectName: ['db', 'ctx.db'],
        },
      ],
      'drizzle/enforce-update-with-where': [
        'error',
        {
          drizzleObjectName: ['db', 'ctx.db'],
        },
      ],
    },
  },

  // =============================================================================
  // SPECIAL FILES (Allow default exports)
  // =============================================================================
  {
    files: [...PATTERNS.NEXTJS_SPECIAL, ...PATTERNS.DISCUNO_ATOMS.MAIN],
    rules: {
      'import/no-default-export': 'off',
    },
  },

  // =============================================================================
  // TEST FILES
  // =============================================================================
  {
    files: [...PATTERNS.TESTS, ...PATTERNS.DISCUNO_ATOMS.TESTS],
    rules: TEST_RELAXED_RULES,
  },

  // =============================================================================
  // CONFIGURATION FILES
  // =============================================================================
  {
    files: [...PATTERNS.CONFIGS, ...PATTERNS.DISCUNO_ATOMS.CONFIGS, ...PATTERNS.ENV],
    languageOptions: NODE_LANGUAGE_OPTIONS,
    rules: {
      ...RELAXED_TYPESCRIPT_RULES,
      'import/no-default-export': 'off',
    },
  },

  // =============================================================================
  // JAVASCRIPT FILES (Disable type checking)
  // =============================================================================
  {
    files: PATTERNS.JAVASCRIPT,
    ...tseslint.configs.disableTypeChecked,
  },
]
