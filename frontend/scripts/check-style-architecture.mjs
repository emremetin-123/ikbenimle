import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(frontendRoot, 'src');
const stylesRoot = path.join(sourceRoot, 'styles');
const expectedImports = [
  './styles/tokens.css',
  './styles/app-shell.css',
  './styles/base-and-layout.css',
  './styles/components.css',
  './styles/employee-theme.css',
  './styles/module-login.css',
  './styles/module-notifications.css',
  './styles/module-ai-settings.css',
  './styles/module-integrations.css',
  './styles/module-announcements.css',
  './styles/module-documents.css',
  './styles/module-leave-requests.css',
  './styles/module-news.css',
  './styles/module-careers.css',
  './styles/module-service-routes.css',
  './styles/module-users.css',
  './styles/module-directory.css',
  './styles/module-legal.css',
  './styles/module-surveys.css',
  './styles/module-feedback.css',
  './styles/module-training.css',
  './styles/module-training-editor.css',
  './styles/module-training-dashboard.css',
  './styles/module-employee-training.css',
  './styles/module-training-player.css',
  './styles/module-profile.css',
  './styles/module-knowledge.css',
  './styles/module-polyvalence.css',
  './styles/module-polyvalence-components.css',
  './styles/module-polyvalence-responsive.css',
  './styles/module-polyvalence-mobile.css',
  './styles/module-polyvalence-workspace.css',
  './styles/module-page-header.css',
  './styles/module-audit.css',
  './styles/responsive.css',
];

const runtimeStyleRules = {
  'AdminServiceRoutes.tsx': [
    { pattern: /style=\{serviceRouteStyle\(/, count: 2 },
  ],
  'AdminSurveys.tsx': [
    { pattern: /style=\{resultBarStyle\(/, count: 1 },
  ],
  'admin-polyvalence/PolyvalenceFormModal.tsx': [
    { pattern: /style=\{levelColorStyle\(/, count: 1 },
  ],
  'admin-polyvalence/PolyvalenceStandardsPanel.tsx': [
    { pattern: /style=\{levelColorStyle\(/, count: 1 },
  ],
  'components/Logo.tsx': [
    { pattern: /style=\{\{ '--logo-size': logoSize \} as React\.CSSProperties\}/, count: 1 },
  ],
  'components/ServiceRouteMap.tsx': [
    { pattern: /style=\{serviceMapHeightStyle\(/, count: 1 },
  ],
  'pages/ServiceRoutes.tsx': [
    { pattern: /style=\{serviceRouteStyle\(/, count: 2 },
  ],
};

const embeddedStyleRules = {
  'components/ServiceRouteMap.tsx': [
    { pattern: /style="--service-marker-color:\$\{color\}"/, count: 1 },
  ],
};

let failed = false;
const maxImportantDeclarations = 0;
const cssFiles = [
  path.join(sourceRoot, 'index.css'),
  path.join(sourceRoot, 'home.css'),
  ...fs.readdirSync(stylesRoot)
    .filter((name) => name.endsWith('.css'))
    .map((name) => path.join(stylesRoot, name)),
];

let importantDeclarationCount = 0;
for (const file of cssFiles.sort()) {
  const relative = path.relative(sourceRoot, file);
  const content = fs.readFileSync(file, 'utf8');
  const lineCount = content.split(/\r?\n/).length;
  importantDeclarationCount += Array.from(content.matchAll(/!important\b/g)).length;
  console.log(`${relative}: ${lineCount}/1200`);
  if (lineCount > 1200) failed = true;
}

console.log(`CSS !important budget: ${importantDeclarationCount}/${maxImportantDeclarations}`);
if (importantDeclarationCount > maxImportantDeclarations) {
  console.error('CSS !important budget exceeded. Remove or justify declarations before raising the limit.');
  failed = true;
}

const actualImports = Array.from(
  fs.readFileSync(path.join(sourceRoot, 'index.css'), 'utf8')
    .matchAll(/@import\s+['"]([^'"]+)['"];/g),
  (match) => match[1],
);

if (actualImports.join('\n') !== expectedImports.join('\n')) {
  console.error('index.css layer order differs from the documented architecture.');
  failed = true;
}

const forbiddenSelector = /^(?::root\b|html\b|body\b|\*|h[1-6]\b|p\b|a\b|table\b|button(?!\.poly)|input(?!\.poly)|select(?!\.poly)|textarea(?!\.poly)|\.(?!poly))/;
for (const name of fs.readdirSync(stylesRoot).filter((file) => file.startsWith('module-polyvalence') && file.endsWith('.css'))) {
  const lines = fs.readFileSync(path.join(stylesRoot, name), 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    const candidate = line.trim();
    if ((candidate.includes('{') || candidate.endsWith(',')) && forbiddenSelector.test(candidate)) {
      console.error(`${name}:${index + 1} contains a selector outside the polyvalence namespace: ${candidate}`);
      failed = true;
    }
  });
}

const sourceFiles = [];
const collectSourceFiles = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) collectSourceFiles(absolute);
    else if (entry.name.endsWith('.tsx')) sourceFiles.push(absolute);
  }
};
collectSourceFiles(sourceRoot);

const ruleMatches = new Map();
const normalizePath = (file) => path.relative(sourceRoot, file).replaceAll(path.sep, '/');
const allRules = (relative) => [
  ...(runtimeStyleRules[relative] || []),
  ...(embeddedStyleRules[relative] || []),
];

for (const file of sourceFiles) {
  const relative = normalizePath(file);
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);
  let singleLineStyleAssignments = 0;
  lines.forEach((line, index) => {
    if (/<style(?:\s|>)/.test(line)) {
      console.error(`${relative}:${index + 1} contains a forbidden embedded <style> element.`);
      failed = true;
    }
    if (!/\bstyle\s*=/.test(line)) return;
    singleLineStyleAssignments += 1;
    const matchingRule = allRules(relative).find((rule) => rule.pattern.test(line));
    if (!matchingRule) {
      console.error(`${relative}:${index + 1} contains an unapproved inline style: ${line.trim()}`);
      failed = true;
      return;
    }
    ruleMatches.set(matchingRule, (ruleMatches.get(matchingRule) || 0) + 1);
  });

  const totalStyleAssignments = Array.from(content.matchAll(/\bstyle\s*=/g)).length;
  if (totalStyleAssignments !== singleLineStyleAssignments) {
    console.error(`${relative} contains a multiline inline style assignment, which is forbidden.`);
    failed = true;
  }
}

for (const ruleSet of [runtimeStyleRules, embeddedStyleRules]) {
  for (const [relative, rules] of Object.entries(ruleSet)) {
    for (const rule of rules) {
      const actual = ruleMatches.get(rule) || 0;
      if (actual !== rule.count) {
        console.error(`${relative} runtime style contract count is ${actual}; expected ${rule.count}.`);
        failed = true;
      }
    }
  }
}

const runtimeStyleCount = Object.values(runtimeStyleRules)
  .flat()
  .reduce((total, rule) => total + rule.count, 0);
console.log(`Approved React runtime styles: ${runtimeStyleCount}/${runtimeStyleCount}`);

if (failed) {
  console.error('Frontend style architecture check failed.');
  process.exit(1);
}
