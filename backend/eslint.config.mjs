import eslint from '@eslint/js'
import { defineConfig } from 'eslint/config'
import prettier from 'eslint-config-prettier'
import tseslint from 'typescript-eslint'

export default defineConfig(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    prettier,
    {
        ignores: [
            'dist/**',
            'node_modules/**',
            'generated/**',
            'src/generated/**',
            'prisma/migrations/**',
            'venv/**',
        ],
    },
    {
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                },
            ],
        },
    },
)
