/**
 * Babel plugin for expo-intents.
 *
 * Intent handlers run later in a bare JavaScriptCore context, so they must be persisted as
 * source strings. Hermes discards function source (`fn.toString()` returns "[bytecode]"), so we
 * cannot serialise at runtime — instead this plugin serialises, at compile time, any function
 * carrying the `'intent'` directive into a string literal of its own source.
 *
 *   registerIntentHandler('getGreeting', async (params, context) => {
 *     'intent';
 *     return 'Hello ' + (getSharedData('user') ?? 'world');
 *   });
 *
 * Why on `enter` + source slicing (and not @babel/generator on `exit`, like the upstream widgets
 * plugin): handlers are typically `async`, and babel-preset-expo's async-to-generator transform
 * rewrites the function before an `exit` visitor runs, leaving the original outer function for
 * Hermes to turn into "[bytecode]". By transforming on `enter` we win the race — we replace the
 * function with a string before any other transform touches it. We grab the verbatim source via
 * the node's offsets into the original file, then strip TypeScript ourselves so the stored string
 * is plain, evaluatable JS.
 */

const DIRECTIVE = 'intent';

module.exports = function expoIntentsBabelPlugin(api) {
  const { types: t } = api;

  function hasIntentDirective(node) {
    return (
      t.isBlockStatement(node.body) &&
      node.body.directives.some(
        (directive) =>
          t.isDirectiveLiteral(directive.value) && directive.value.value === DIRECTIVE
      )
    );
  }

  function sourceLiteral(path, state) {
    const node = path.node;
    const code = state.file && state.file.code;
    let source;
    if (typeof code === 'string' && node.start != null && node.end != null) {
      source = code.slice(node.start, node.end);
    } else {
      // Fallback for synthetic nodes without source positions.
      source = require('@babel/generator').default(node, { compact: true }).code;
    }
    const stripped = stripTypeScript(source);
    const raw = stripped.replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
    return t.templateLiteral([t.templateElement({ raw, cooked: raw }, true)], []);
  }

  function stripTypeScript(source) {
    try {
      const result = api.transformSync(`(${source})`, {
        configFile: false,
        babelrc: false,
        comments: false,
        compact: true,
        filename: 'expo-intent-handler.tsx',
        presets: [require('@babel/preset-typescript')],
      });
      if (result && typeof result.code === 'string') {
        return result.code.trim().replace(/;$/, '');
      }
    } catch {
      // Fall through to the raw (possibly TS-laden) source; better than dropping the handler.
    }
    return `(${source})`;
  }

  return {
    name: 'expo-intents',
    visitor: {
      ['ArrowFunctionExpression|FunctionExpression']: {
        enter(path, state) {
          if (!hasIntentDirective(path.node)) {
            return;
          }
          path.replaceWith(sourceLiteral(path, state));
          path.skip();
        },
      },
      FunctionDeclaration: {
        enter(path, state) {
          if (!hasIntentDirective(path.node)) {
            return;
          }
          const literal = sourceLiteral(path, state);
          if (path.parentPath.isExportDefaultDeclaration()) {
            path.parentPath.replaceWith(t.exportDefaultDeclaration(literal));
          } else if (path.node.id) {
            path.replaceWith(
              t.variableDeclaration('var', [t.variableDeclarator(path.node.id, literal)])
            );
          } else {
            path.replaceWith(literal);
          }
          path.skip();
        },
      },
    },
  };
};
