import {createElement} from 'react';
import {createRoot} from 'react-dom/client';
import * as app from '@eforge/app';
import * as core from '@eforge/core';
import * as data from '@eforge/data';
import * as forms from '@eforge/forms';
import * as patterns from '@eforge/patterns';
import * as schema from '@eforge/schema-contract';
import * as tokens from '@eforge/tokens';
import * as ui from '@eforge/ui';
import '@eforge/tokens/styles.css';
import '@eforge/ui/styles.css';
import '@eforge/patterns/styles.css';
import '@eforge/app/styles.css';
import '@eforge/data/styles.css';
import '@eforge/forms/styles.css';

// Exercise every public package entry and stylesheet through the consumer bundler.
const packages = {app, core, data, forms, patterns, schema, tokens, ui};
const root = document.getElementById('root');
if (root) createRoot(root).render(createElement('div', null,
  createElement(ui.Button, {label: 'EForge package ready'}),
  createElement('pre', null, JSON.stringify(Object.fromEntries(
    Object.entries(packages).map(([name, exports]) => [name, Object.keys(exports)])), null, 2))));
