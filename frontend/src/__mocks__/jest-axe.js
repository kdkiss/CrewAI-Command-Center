const createEmptyResult = () => ({
  violations: [],
  passes: [],
  incomplete: [],
  inapplicable: []
});

const describeNode = (node) => {
  if (!node || typeof node.tagName === 'undefined') {
    return 'unknown-node';
  }

  const tag = node.tagName ? node.tagName.toLowerCase() : 'unknown';
  const id = node.id ? `#${node.id}` : '';
  let classNames = '';

  if (typeof node.className === 'string' && node.className.trim()) {
    classNames = `.${node.className.trim().split(/\s+/).join('.')}`;
  }

  return `${tag}${id}${classNames}`;
};

const recordImageAltViolations = (container, result) => {
  const images = Array.from(container.querySelectorAll ? container.querySelectorAll('img') : []);

  if (images.length === 0) {
    return;
  }

  const failures = [];

  images.forEach((image) => {
    const ariaHidden = image.getAttribute && image.getAttribute('aria-hidden');
    const role = image.getAttribute && image.getAttribute('role');

    if (ariaHidden === 'true' || role === 'presentation') {
      result.passes.push({
        id: 'image-alt',
        nodes: [{ target: [describeNode(image)] }],
        description: 'Decorative image is hidden from assistive technology.'
      });
      return;
    }

    const alt = image.getAttribute ? image.getAttribute('alt') : '';

    if (!alt || !alt.trim()) {
      failures.push(image);
    } else {
      result.passes.push({
        id: 'image-alt',
        nodes: [{ target: [describeNode(image)] }],
        description: 'Image includes alternative text.'
      });
    }
  });

  if (failures.length > 0) {
    result.violations.push({
      id: 'image-alt',
      impact: 'serious',
      description: 'Images must include descriptive alternative text.',
      help: 'Provide meaningful alt text for informative images or mark decorative images appropriately.',
      nodes: failures.map((node) => ({
        target: [describeNode(node)],
        failureSummary: 'Image element is missing meaningful alternative text.'
      }))
    });
  }
};

const recordLabelledByViolations = (container, result) => {
  if (!container.querySelectorAll) {
    return;
  }

  const labelledElements = Array.from(container.querySelectorAll('[aria-labelledby]'));

  if (labelledElements.length === 0) {
    return;
  }

  const doc = container.ownerDocument || (typeof document !== 'undefined' ? document : null);
  const failures = [];

  labelledElements.forEach((element) => {
    const rawIds = element.getAttribute('aria-labelledby') || '';
    const ids = rawIds.split(/\s+/).filter(Boolean);

    if (ids.length === 0) {
      failures.push({ node: element, missing: [] });
      return;
    }

    const missing = ids.filter((id) => {
      if (!doc || typeof doc.getElementById !== 'function') {
        return false;
      }

      return !doc.getElementById(id);
    });

    if (missing.length > 0) {
      failures.push({ node: element, missing });
    } else {
      result.passes.push({
        id: 'aria-labelledby',
        nodes: [{ target: [describeNode(element)] }],
        description: 'Element references a valid labelling element.'
      });
    }
  });

  if (failures.length > 0) {
    result.violations.push({
      id: 'aria-labelledby',
      impact: 'moderate',
      description: 'Elements using aria-labelledby must reference existing elements.',
      help: 'Ensure all ids referenced in aria-labelledby are present in the DOM.',
      nodes: failures.map(({ node, missing }) => ({
        target: [describeNode(node)],
        failureSummary: missing.length > 0
          ? `Missing labelled element(s): ${missing.join(', ')}`
          : 'aria-labelledby attribute is present but empty.'
      }))
    });
  }
};

async function axe(container) {
  const result = createEmptyResult();

  if (!container || typeof container.querySelectorAll !== 'function') {
    return result;
  }

  recordImageAltViolations(container, result);
  recordLabelledByViolations(container, result);

  return result;
}

const formatViolation = (violation, index) => {
  const header = `${index + 1}. [${violation.id || 'unknown'}] ${violation.description || 'Accessibility issue detected.'}`;
  const nodeSummaries = (violation.nodes || []).map((node, nodeIndex) => {
    const target = Array.isArray(node.target) ? node.target.join(', ') : 'unknown target';
    const summary = node.failureSummary ? `: ${node.failureSummary}` : '';
    return `    ${nodeIndex + 1}. ${target}${summary}`;
  });

  return [header, ...nodeSummaries].join('\n');
};

const toHaveNoViolations = {
  toHaveNoViolations(received) {
    if (received && typeof received.then === 'function') {
      throw new Error('`toHaveNoViolations` matcher requires a resolved axe result. Did you forget to await axe()?');
    }

    const violations = Array.isArray(received?.violations) ? received.violations : [];
    const pass = violations.length === 0;

    return {
      pass,
      message: () => {
        if (pass) {
          return 'Expected the axe results to contain accessibility violations, but none were detected.';
        }

        const details = violations.map((violation, index) => formatViolation(violation, index)).join('\n\n');
        return `Expected no accessibility violations. Found ${violations.length} issue(s):\n${details}`;
      }
    };
  }
};

module.exports = {
  axe,
  toHaveNoViolations
};
