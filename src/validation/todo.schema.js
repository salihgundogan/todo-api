// backend/src/validation/todo.schema.js

const { z } = require('zod');

// Todo oluştururken veya güncellerken kullanılacak doğrulama şeması
const todoSchema = z.object({
    title: z
        .string({ required_error: 'Title is required' })
        .min(3, { message: 'Title must be at least 3 characters long' })
        .max(100, { message: 'Title must be 100 characters or less' }),

    category_id: z
        .number({ required_error: 'Category ID is required' })
        .int()
        .positive({ message: 'Category ID must be a positive number' }),

    importance: z
        .enum(['düşük', 'orta', 'yüksek'], {
            errorMap: () => ({ message: "Importance must be 'düşük', 'orta', or 'yüksek'" })
        }),
    deadline: z
    .string()
    .optional()
    .nullable()
    
});

module.exports = {
    todoSchema,
};