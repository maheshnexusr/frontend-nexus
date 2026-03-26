// ── LEFT PANEL TABS ─────────────────────────────────────────────
export const FIELD_TABS = {
  fields: [
    { type: 'text',        label: 'Short text',      description: 'Single line input',                  icon: 'Type',          color: '#4f46e5' },
    { type: 'textarea',    label: 'Long text',        description: 'Multi-line input',                   icon: 'AlignLeft',     color: '#4f46e5' },
    { type: 'editor',      label: 'Text editor',      description: 'Text editor with formatting',        icon: 'Bold',          color: '#4f46e5' },
    { type: 'number',      label: 'Number',           description: 'Numbers only input',                 icon: 'Hash',          color: '#4f46e5' },
    { type: 'email',       label: 'Email',            description: 'Email address input',                icon: 'Mail',          color: '#4f46e5' },
    { type: 'phone',       label: 'Phone',            description: 'Phone number input',                 icon: 'Phone',         color: '#4f46e5' },
    { type: 'password',    label: 'Password',         description: 'Hidden character input',             icon: 'Lock',          color: '#4f46e5' },
    { type: 'url',         label: 'URL',              description: 'Website URL input',                  icon: 'Globe',         color: '#4f46e5' },
    { type: 'signature',   label: 'Signature',        description: 'Draw or type signature',             icon: 'Pen',           color: '#4f46e5' },
    { type: 'location',    label: 'Location',         description: 'Location / address input',           icon: 'MapPin',        color: '#4f46e5' },
    { type: 'paragraph',   label: 'Paragraph',        description: 'Formattable text block',             icon: 'AlignLeft',     color: '#475569' },
    { type: 'select',      label: 'Select',           description: 'Single option dropdown',             icon: 'ChevronDown',   color: '#7c3aed' },
    { type: 'multiselect', label: 'Multiselect',      description: 'Multiple option dropdown',           icon: 'List',          color: '#7c3aed' },
    { type: 'tags',        label: 'Tags',             description: 'Tag / token input',                  icon: 'Tag',           color: '#7c3aed' },
    { type: 'checkbox',    label: 'Decision box',     description: 'Single checkbox',                    icon: 'CheckSquare',   color: '#7c3aed' },
    { type: 'checkboxgroup', label: 'Multiple choice', description: 'Accept multiple options',           icon: 'ListChecks',    color: '#7c3aed' },
    { type: 'radiogroup',  label: 'Single choice',    description: 'Accept a single option',             icon: 'Circle',        color: '#7c3aed' },
    { type: 'toggle',      label: 'Toggle',           description: 'Toggle / switch button',             icon: 'ToggleLeft',    color: '#7c3aed' },
    { type: 'date',        label: 'Date',             description: 'Date picker',                        icon: 'Calendar',      color: '#db2777' },
    { type: 'datetime',    label: 'Date & Time',      description: 'Date + time picker',                 icon: 'CalendarDays',  color: '#db2777' },
    { type: 'time',        label: 'Time',             description: 'Time picker',                        icon: 'Clock',         color: '#db2777' },
    { type: 'dates',       label: 'Dates',            description: 'Multiple date picker',               icon: 'CalendarRange', color: '#db2777' },
    { type: 'daterange',   label: 'Date range',       description: 'Date range picker',                  icon: 'CalendarRange', color: '#db2777' },
    { type: 'slider',      label: 'Slider',           description: 'Horizontal range slider',            icon: 'Sliders',       color: '#d97706' },
    { type: 'rangeslider', label: 'Range slider',     description: 'Dual-handle range slider',           icon: 'Sliders',       color: '#d97706' },
    { type: 'rating',      label: 'Rating',           description: 'Star rating input',                  icon: 'Star',          color: '#d97706' },
    { type: 'file',        label: 'File',             description: 'Single file upload',                 icon: 'FileUp',        color: '#059669' },
    { type: 'multifile',   label: 'Multifile',        description: 'Multiple file upload',               icon: 'Files',         color: '#059669' },
    { type: 'image',       label: 'Image',            description: 'Image upload',                       icon: 'Image',         color: '#059669' },
    { type: 'multiimage',  label: 'Multi-image',      description: 'Multiple image upload',              icon: 'Images',        color: '#059669' },
  ],
  page: [
    { type: 'h1',      label: 'Form heading',    description: 'Heading for form',              icon: 'Heading1',      color: '#475569' },
    { type: 'h2',      label: 'Section heading', description: 'Heading for sections',          icon: 'Heading2',      color: '#475569' },
    { type: 'h3',      label: 'Subheading',      description: 'Heading for subsections',       icon: 'Heading3',      color: '#475569' },
    { type: 'divider', label: 'Divider',         description: 'Adds visual separation',        icon: 'Minus',         color: '#475569' },
    { type: 'spacer',  label: 'Spacer',          description: 'Empty space between elements',  icon: 'MoveVertical',  color: '#475569' },
    { type: 'submit',  label: 'Submit',          description: 'Triggers form submission',      icon: 'Square',        color: '#475569' },
    { type: 'button',  label: 'Button',          description: 'Clickable action button',       icon: 'MousePointer',  color: '#475569' },
    { type: 'link',    label: 'Link',            description: 'Link to another website',       icon: 'Link2',         color: '#475569' },
    { type: 'steps',   label: 'Pages',           description: 'Break the form into steps',     icon: 'Layers',        color: '#0ea5e9' },
  ],
};

export const ALL_FIELD_TYPES = [...FIELD_TABS.fields, ...FIELD_TABS.page];

export function getFieldInfo(type) {
  return ALL_FIELD_TYPES.find((f) => f.type === type) || { type, label: type, icon: 'Database', color: '#64748b' };
}

export function createField(type) {
  const info = getFieldInfo(type);
  const uid = Math.random().toString(36).slice(2, 7);
  const id = `${type}_${Date.now()}`;

  const base = {
    id, type,
    label: '',
    name: `${type}_${uid}`,
    placeholder: info.label,
    description: '',
    tooltip: '',
    size: 'default',
    shrinkElement: false,
    elementSize: '1/2',
    labelPosition: 'top',
    columns: 12,
    showLabel: true,
    validation: {
      required: false, minLength: '', maxLength: '', min: '', max: '',
      pattern: '', email: false, url: false, numeric: false, validateOn: 'submit', rules: [],
    },
    conditions: { enabled: false, logic: 'AND', rules: [] },
    attributes: { disabled: false, readonly: false, autofocus: false, autocomplete: '', id: '', class: '' },
    decorators: { prefix: '', suffix: '', before: '', after: '' },
  };

  switch (type) {
    case 'email':    base.validation.email = true;   base.placeholder = 'Email'; break;
    case 'url':      base.validation.url = true;     base.placeholder = 'https://'; break;
    case 'number':   base.validation.numeric = true; base.placeholder = '0'; break;
    case 'phone':    base.placeholder = 'Phone'; base.countries = ['all']; break;
    case 'password': base.placeholder = 'Password'; break;
    case 'textarea': base.rows = 3; base.placeholder = ''; break;
    case 'select':
    case 'multiselect':
    case 'checkboxgroup':
    case 'radiogroup':
    case 'tags':
      base.options = [
        { label: 'Option 1', value: 'option_1' },
        { label: 'Option 2', value: 'option_2' },
        { label: 'Option 3', value: 'option_3' },
      ];
      base.searchable = false;
      base.placeholder = 'Select an option';
      break;
    case 'checkbox':    base.text = 'I agree to the terms and conditions'; break;
    case 'toggle':      base.trueLabel = 'Yes'; base.falseLabel = 'No'; base.placeholder = ''; break;
    case 'slider':      base.min = 0; base.max = 100; base.step = 1; base.defaultValue = 50; base.placeholder = ''; break;
    case 'rangeslider': base.min = 0; base.max = 100; base.step = 1; base.defaultValue = [20, 80]; base.placeholder = ''; break;
    case 'rating':      base.min = 0; base.max = 5; base.defaultValue = 0; base.placeholder = ''; break;
    case 'h1': base.content = 'Form Heading';    base.showLabel = false; base.placeholder = ''; break;
    case 'h2': base.content = 'Section Heading'; base.showLabel = false; base.placeholder = ''; break;
    case 'h3': base.content = 'Subheading';      base.showLabel = false; base.placeholder = ''; break;
    case 'divider': base.showLabel = false; base.placeholder = ''; break;
    case 'spacer':  base.height = 24; base.showLabel = false; base.placeholder = ''; break;
    case 'button':  base.buttonLabel = 'Button'; base.buttonType = 'button'; base.buttonVariant = 'primary'; base.showLabel = false; base.placeholder = ''; break;
    case 'submit':  base.label = 'Submit'; base.buttonLabel = 'Submit'; base.buttonType = 'submit'; base.buttonVariant = 'primary'; base.showLabel = false; base.placeholder = ''; break;
    case 'link':    base.linkText = 'Click here'; base.linkUrl = '#'; base.showLabel = false; base.placeholder = ''; break;
    case 'steps':   base.label = 'Pages'; base.steps = ['Step 1', 'Step 2']; base.showLabel = false; base.placeholder = ''; break;
    case 'file': case 'image':       base.accept = type === 'image' ? 'image/*' : ''; base.maxSize = 5; base.placeholder = ''; break;
    case 'multifile': case 'multiimage': base.accept = type === 'multiimage' ? 'image/*' : ''; base.maxSize = 5; base.maxFiles = 10; base.placeholder = ''; break;
    case 'paragraph': base.content = 'Paragraph text goes here.'; base.showLabel = false; base.placeholder = ''; break;
  }
  return base;
}

export const OPERATORS = [
  { value: '==',        label: 'equals' },
  { value: '!=',        label: 'not equals' },
  { value: '>',         label: 'greater than' },
  { value: '>=',        label: 'greater than or equal' },
  { value: '<',         label: 'less than' },
  { value: '<=',        label: 'less than or equal' },
  { value: '^',         label: 'starts with' },
  { value: '$',         label: 'ends with' },
  { value: '*',         label: 'contains' },
  { value: 'in',        label: 'in' },
  { value: 'not_in',    label: 'not in' },
  { value: 'empty',     label: 'is empty' },
  { value: 'not_empty', label: 'is not empty' },
];
