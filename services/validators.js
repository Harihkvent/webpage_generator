/**
 * validators.js
 * Comprehensive request validation and data sanitization using Zod & sanitize-html
 */

const { z } = require('zod');
const sanitizeHtml = require('sanitize-html');

// Common sanitizer options: allow basic rich text tags but strip scripts/iframes/event handlers
const sanitizeOptions = {
  allowedTags: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'b', 'i', 'strong', 'em', 'strike',
    'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'hr', 'br', 'table', 'thead',
    'tbody', 'tr', 'th', 'td', 'a', 'span'
  ],
  allowedAttributes: {
    'a': ['href', 'title', 'target', 'rel'],
    '*': ['class', 'id', 'style']
  },
  allowedSchemes: ['http', 'https', 'mailto', 'data']
};

/**
 * Sanitize untrusted HTML or text
 */
function cleanHtml(dirty) {
  if (typeof dirty !== 'string') return '';
  return sanitizeHtml(dirty, sanitizeOptions).trim();
}

/**
 * Strip all HTML completely for plain text fields
 */
function cleanText(dirty) {
  if (typeof dirty !== 'string') return '';
  return sanitizeHtml(dirty, { allowedTags: [], allowedAttributes: {} }).trim();
}

// Color Hex validation regex
const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

// User Registration Schema
const signupSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(60, 'Name must not exceed 60 characters'),
  email: z.string().trim().email('Invalid email address').max(100),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128)
});

// User Login Schema
const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

// Create Project Schema
const createProjectSchema = z.object({
  companyName: z.string().trim().min(1, 'Company Name is required').max(100),
  brandColor: z.string().trim().regex(hexColorRegex, 'Invalid Hex color format (e.g. #6366F1)').default('#6366F1'),
  logoUrl: z.string().trim().optional().default(''),
  topics: z.array(z.string().trim().min(1, 'Topic cannot be empty'))
    .min(1, 'At least 1 topic is required')
    .max(10, 'A maximum of 10 topics is supported'),
  llmProvider: z.enum(['builtin', 'gemini']).optional().default('builtin'),
  apiKey: z.string().trim().optional().default(''),
  authorName: z.string().trim().max(100).optional().default(''),
  authorRole: z.string().trim().max(100).optional().default(''),
  authorBio: z.string().trim().max(500).optional().default(''),
  authorAvatar: z.string().trim().optional().default('')
});

// Update Project (Campaign branding & author settings)
const updateProjectSchema = z.object({
  companyName: z.string().trim().min(1).max(100).optional(),
  brandColor: z.string().trim().regex(hexColorRegex, 'Invalid Hex color format').optional(),
  logoUrl: z.string().trim().optional(),
  authorName: z.string().trim().max(100).optional(),
  authorRole: z.string().trim().max(100).optional(),
  authorBio: z.string().trim().max(500).optional(),
  authorAvatar: z.string().trim().optional()
});

// Update Individual Article
const updateArticleSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').optional(),
  summary: z.string().trim().optional(),
  keyTakeaways: z.array(z.string().trim()).optional(),
  sections: z.array(z.object({
    id: z.string().optional(),
    h2: z.string().optional(),
    subsections: z.array(z.object({
      h3: z.string().optional(),
      paragraphs: z.array(z.string()).optional()
    })).optional()
  })).optional(),
  faqs: z.array(z.object({
    q: z.string().optional(),
    a: z.string().optional()
  })).optional(),
  readingTime: z.string().trim().optional()
});

/**
 * Express middleware helper for schema validation
 */
function validateBody(schema) {
  return (req, res, next) => {
    try {
      const parsed = schema.parse(req.body);
      req.validatedBody = parsed;
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        const issues = err.issues || err.errors || [];
        const errorMessages = issues.map(e => `${(e.path || []).join('.')}: ${e.message}`).join(', ');
        return res.status(400).json({ error: errorMessages || err.message, details: issues });
      }
      return res.status(400).json({ error: 'Invalid request data' });
    }
  };
}

module.exports = {
  cleanHtml,
  cleanText,
  signupSchema,
  loginSchema,
  createProjectSchema,
  updateProjectSchema,
  updateArticleSchema,
  validateBody
};
