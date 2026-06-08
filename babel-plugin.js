/**
 * Babel plugin for expo-intents.
 *
 * Intent handlers run later in a bare JavaScriptCore context, so they must be persisted as
 * source strings. Hermes discards function source (`fn.toString()` returns "[bytecode]"), so we
 * cannot serialise at runtime — instead this plugin serialises, at compile time, any function
 * carrying the `'intent'` directive into a string literal of its own source.
 *
 * Add it to your babel.config.js plugins, then mark handlers:
 *
 *   registerIntentHandler('getGreeting', async (params, context) => {
 *     'intent';
 *     return 'Hello ' + (getSharedData('user') ?? 'world');
 *   });
 *
 * Modelled on babel-preset-expo's widgets plugin (the `'widget'` directive).
 */

const DIRECTIVE = 'intent';

module.exports = function expoIntentsBabelPlugin(api) {
  const { types: t } = api;
  const generate = requireGenerator();

  function hasIntentDirective(node) {
    return (
      t.isBlockStatement(node.body) &&
      node.body.directives.some(
        (directive) =>
          t.isDirectiveLiteral(directive.value) && directive.value.value === DIRECTIVE
      )
    );
  }

  function removeIntentDirective(body) {
    const index = body.directives.findIndex(
      (directive) => t.isDirectiveLiteral(directive.value) && directive.value.value === DIRECTIVE
    );
    if (index !== -1) {
      body.directives.splice(index, 1);
    }
  }

  function toSourceLiteral(node) {
    const expression = t.functionExpression(
      null,
      node.params,
      node.body,
      node.generator,
      node.async
    );
    const code = generate(expression, { compact: true }).code;
    const raw = code.replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
    return t.templateLiteral([t.templateElement({ raw, cooked: raw }, true)], []);
  }

  return {
    name: 'expo-intents',
    visitor: {
      ['FunctionDeclaration|FunctionExpression']: {
        exit(path) {
          if (!hasIntentDirective(path.node)) {
            return;
          }
          removeIntentDirective(path.node.body);
          const literal = toSourceLiteral(path.node);

          if (path.parentPath.isExportDefaultDeclaration()) {
            path.parentPath.replaceWith(t.exportDefaultDeclaration(literal));
          } else if (path.node.id) {
            path.replaceWith(
              t.variableDeclaration('var', [t.variableDeclarator(path.node.id, literal)])
            );
          } else {
            path.replaceWith(literal);
          }
        },
      },
      ArrowFunctionExpression: {
        exit(path) {
          if (!hasIntentDirective(path.node)) {
            return;
          }
          removeIntentDirective(path.node.body);
          path.replaceWith(toSourceLiteral(path.node));
        },
      },
    },
  };
};

function requireGenerator() {
  const mod = require('@babel/generator');
  return mod.default || mod;
}
