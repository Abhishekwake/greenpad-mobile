const WorkflowTemplate = require('../models/WorkflowTemplate');
const Role = require('../models/Role');

const TEMPLATE_VERSION = 2;

/** From client Excel: Phase → Stage → Task hierarchy */
const DEFAULT_PHASES = [
  {
    phaseId: 'phase_sales',
    name: 'Enquiry',
    order: 1,
    stages: [
      {
        stageId: 'stage_enquiry',
        name: 'Enquiry',
        order: 1,
        visibleToCustomer: true,
        tasks: [
          { taskId: 'task_enquiry_type', name: 'Lead type (Online / Referral / Other)', assignedRole: 'Sales Team', docRequired: false },
        ],
      },
      {
        stageId: 'stage_site_visit',
        name: 'Site Visit',
        order: 2,
        visibleToCustomer: true,
        tasks: [
          { taskId: 'task_site_visit_schedule', name: 'Schedule site visit', assignedRole: 'Site Engineer', docRequired: false },
          { taskId: 'task_site_visit_complete', name: 'Complete site assessment', assignedRole: 'Site Engineer', docRequired: true },
        ],
      },
      {
        stageId: 'stage_final_customer',
        name: 'Final Customer Confirmation',
        order: 3,
        visibleToCustomer: true,
        tasks: [
          { taskId: 'task_final_customer', name: 'Customer confirmation & quotation approval', assignedRole: 'Sales Team', docRequired: false },
        ],
      },
      {
        stageId: 'stage_follow_up',
        name: 'Follow Up',
        order: 4,
        visibleToCustomer: false,
        tasks: [
          { taskId: 'task_follow_up', name: 'Sales follow-up call', assignedRole: 'Sales Team', docRequired: false },
        ],
      },
    ],
  },
  {
    phaseId: 'phase_documentation',
    name: 'Documentation & Application',
    order: 2,
    stages: [
      {
        stageId: 'stage_doc_collection',
        name: 'Document Collection',
        order: 1,
        visibleToCustomer: true,
        tasks: [
          { taskId: 'task_aadhaar', name: 'Aadhaar upload', assignedRole: 'Documentation Team', docRequired: true },
          { taskId: 'task_pan', name: 'PAN upload', assignedRole: 'Documentation Team', docRequired: true },
          { taskId: 'task_electricity_bill', name: 'Electricity bill upload', assignedRole: 'Documentation Team', docRequired: true },
        ],
      },
      {
        stageId: 'stage_name_change',
        name: 'Name Change',
        order: 2,
        visibleToCustomer: true,
        tasks: [
          { taskId: 'task_name_correction', name: 'Name correction', assignedRole: 'Documentation Team', docRequired: true },
          { taskId: 'task_name_documentation', name: 'Documentation submission', assignedRole: 'Documentation Team', docRequired: true },
          { taskId: 'task_mseb_name', name: 'MSEB work', assignedRole: 'Electric Department Coordinator', docRequired: false },
        ],
      },
      {
        stageId: 'stage_national_portal',
        name: 'National Portal Application',
        order: 3,
        visibleToCustomer: true,
        tasks: [
          { taskId: 'task_portal_apply', name: 'Portal registration & application', assignedRole: 'Documentation Team', docRequired: true },
        ],
      },
      {
        stageId: 'stage_bank_loan',
        name: 'Bank Loan',
        order: 4,
        visibleToCustomer: true,
        tasks: [
          { taskId: 'task_loan_application', name: 'Application', assignedRole: 'Finance Team', docRequired: true },
          { taskId: 'task_bank_work', name: 'Bank work', assignedRole: 'Finance Team', docRequired: false },
          { taskId: 'task_1st_disbursement', name: '1st Disbursement', assignedRole: 'Finance Team', docRequired: false },
          { taskId: 'task_2nd_disbursement', name: '2nd Disbursement', assignedRole: 'Finance Team', docRequired: false },
        ],
      },
    ],
  },
  {
    phaseId: 'phase_site',
    name: 'Site',
    order: 3,
    stages: [
      {
        stageId: 'stage_material_dispatch',
        name: 'Material Dispatch',
        order: 1,
        visibleToCustomer: true,
        tasks: [
          { taskId: 'task_material_dispatch', name: 'Dispatch panels & inverter to site', assignedRole: 'Installer', docRequired: false },
        ],
      },
      {
        stageId: 'stage_site_completion',
        name: 'Site Completion',
        order: 2,
        visibleToCustomer: true,
        tasks: [
          { taskId: 'task_welding', name: 'Welding / structure work', assignedRole: 'Installer', docRequired: true },
          { taskId: 'task_wiring', name: 'Wiring & DC/AC connections', assignedRole: 'Installer', docRequired: true },
          { taskId: 'task_panel_mount', name: 'Panel mounting', assignedRole: 'Installer', docRequired: true },
        ],
      },
    ],
  },
  {
    phaseId: 'phase_final_docs',
    name: 'Final Documentation',
    order: 4,
    stages: [
      {
        stageId: 'stage_mseb_final',
        name: 'MSEB Final Documentation',
        order: 1,
        visibleToCustomer: true,
        tasks: [
          { taskId: 'task_mseb_docs', name: 'MSEB documentation submission', assignedRole: 'Documentation Team', docRequired: true },
          { taskId: 'task_inspection_release', name: 'Inspection release order', assignedRole: 'Electric Department Coordinator', docRequired: true },
        ],
      },
      {
        stageId: 'stage_net_metering',
        name: 'Net Metering',
        order: 2,
        visibleToCustomer: true,
        tasks: [
          { taskId: 'task_net_meter_install', name: 'Net meter installation', assignedRole: 'Electric Department Coordinator', docRequired: false },
        ],
      },
    ],
  },
  {
    phaseId: 'phase_warranty',
    name: 'Warranty',
    order: 5,
    stages: [
      {
        stageId: 'stage_warranty_panels',
        name: 'Panel Warranty Registration',
        order: 1,
        visibleToCustomer: true,
        tasks: [
          { taskId: 'task_warranty_panels', name: 'Panel warranty registration', assignedRole: 'Documentation Team', docRequired: true },
        ],
      },
      {
        stageId: 'stage_warranty_inverter',
        name: 'Inverter Warranty Registration',
        order: 2,
        visibleToCustomer: true,
        tasks: [
          { taskId: 'task_warranty_inverter', name: 'Inverter warranty registration', assignedRole: 'Documentation Team', docRequired: true },
        ],
      },
      {
        stageId: 'stage_docs_handover',
        name: 'Documents Handover',
        order: 3,
        visibleToCustomer: true,
        tasks: [
          { taskId: 'task_docs_handover', name: 'Handover all documents to customer', assignedRole: 'Documentation Team', docRequired: true },
        ],
      },
    ],
  },
  {
    phaseId: 'phase_maintenance',
    name: 'Maintenance',
    order: 6,
    stages: [
      {
        stageId: 'stage_plant_maintenance',
        name: 'Plant Maintenance',
        order: 1,
        visibleToCustomer: true,
        tasks: [
          { taskId: 'task_cleaning', name: 'Panel cleaning', assignedRole: 'Maintenance Team', docRequired: false },
          { taskId: 'task_maintenance_visit', name: 'Maintenance visit', assignedRole: 'Maintenance Team', docRequired: false },
        ],
      },
    ],
  },
];

const DEFAULT_ROLES = [
  'Sales Team',
  'Documentation Team',
  'Finance Team',
  'Site Engineer',
  'Installer',
  'Electric Department Coordinator',
  'Maintenance Team',
];

async function seedWorkflow() {
  const existing = await WorkflowTemplate.findOne({ tenantId: 'greenpad' });

  if (!existing || !existing.phases?.length || existing.version !== TEMPLATE_VERSION) {
    await WorkflowTemplate.findOneAndUpdate(
      { tenantId: 'greenpad' },
      {
        tenantId: 'greenpad',
        name: 'Default Solar Workflow',
        version: TEMPLATE_VERSION,
        phases: DEFAULT_PHASES,
        stages: [],
      },
      { upsert: true, new: true }
    );
    console.log('Seeded hierarchical workflow template (v2) from office workflow');
  }

  for (const name of DEFAULT_ROLES) {
    await Role.findOneAndUpdate(
      { tenantId: 'greenpad', name },
      { tenantId: 'greenpad', name, isActive: true },
      { upsert: true, new: true }
    );
  }
}

module.exports = seedWorkflow;
