const controller = require('../controllers/studentController');
const studentService = require('../services/studentService');

studentService.updateStudent = async () => null;

const req = { params: { id: 'nope' }, user: { tenantId: 't1' }, body: {} };
let lastStatus, lastJson;
const json = (obj) => { lastJson = obj; console.log('json called with:', obj); };
const status = (s) => { lastStatus = s; return { json }; };
const res = { status };

(async () => {
  await controller.updateStudent(req, res, () => {});
  console.log('status was', lastStatus);
  process.exit(0);
})();
