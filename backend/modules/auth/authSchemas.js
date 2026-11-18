const { z } = require('zod');

const loginSchema = z.object({
    employee_id: z.string().trim().min(1).max(50),
    password: z.string().min(1).max(200)
}).strict();

module.exports = { loginSchema };
