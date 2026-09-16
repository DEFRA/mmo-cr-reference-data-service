import neostandard from 'neostandard'

export default [
  ...neostandard({
    env: ['node', 'vitest'],
    ignores: [...neostandard.resolveIgnoresFromGitignore()],
    noJsx: true,
    noStyle: true
  }),
  {
    // Only these fixtures use JSON import attributes (`with { type: 'json' }`), which need ecmaVersion 2025+.
    files: ['src/common/schemas/fixtures/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest'
    }
  }
]
