# Security Policy

## Reporting Security Vulnerabilities

If you discover a security vulnerability in T-Link, please report it by emailing the security team. Please do not create public GitHub issues for security vulnerabilities.

**Note:** Update the security contact email address to your organization's actual monitored security email.

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.0.x   | :white_check_mark: |
| 1.x.x   | :x:                |

## Security Features

### Authentication & Authorization

- **JWT Authentication**: Tokens expire after 24 hours by default
- **Password Requirements**: Minimum 8 characters with uppercase, lowercase, and numbers
- **Rate Limiting**: Protects against brute force attacks
- **Account Lockout**: Temporary lockout after 5 failed login attempts
- **Role-Based Access Control**: Admin, Lab Staff, Logistics, Manufacturer roles

### Input Validation & Sanitization

- **Joi Schema Validation**: All API endpoints validate input data
- **XSS Prevention**: Input sanitization escapes HTML special characters
- **SQL Injection Prevention**: Parameterized queries used throughout
- **File Upload Validation**: Type, size, and MIME type checking

### Network Security

- **CORS Configuration**: Whitelist of allowed origins
- **Helmet Security Headers**: XSS protection, HSTS, frame options, etc.
- **Rate Limiting**: Per-endpoint rate limits
- **HTTPS Required**: Production deployments must use HTTPS

### Data Protection

- **Password Hashing**: Bcrypt with salt rounds
- **Sensitive Data**: Never logged or exposed in error messages
- **Environment Variables**: Credentials stored in environment variables, not code
- **Database Encryption**: SSL/TLS required for database connections in production

### File Security

- **Upload Validation**: File type whitelist and size limits
- **Secure Storage**: Files stored in Cloudinary with access controls
- **Filename Sanitization**: Prevents directory traversal attacks
- **Content Type Verification**: MIME type must match file extension

## Security Best Practices for Deployment

### Environment Variables

Never commit `.env` files. Required variables:

```bash
# Required for all deployments
JWT_SECRET=<minimum_32_character_random_string>
DB_PASSWORD=<strong_database_password>
CLOUDINARY_API_SECRET=<cloudinary_secret>

# Optional but recommended
SMTP_PASSWORD=<email_password>
FEDEX_SECRET_KEY=<fedex_secret>
```

### Database Security

1. Use strong, unique passwords for database users
2. Enable SSL/TLS for database connections in production
3. Restrict database access to application servers only
4. Regularly backup the database
5. Keep PostgreSQL updated to the latest stable version

### Application Security

1. Always use HTTPS in production
2. Configure CORS to only allow your frontend domain
3. Set secure cookie options (httpOnly, secure, sameSite)
4. Keep all dependencies updated
5. Regularly run `npm audit` to check for vulnerabilities
6. Monitor application logs for suspicious activity

### Access Control

1. Use least privilege principle for database users
2. Disable or secure admin endpoints in production
3. Implement IP whitelisting for sensitive endpoints if possible
4. Regularly review user access and permissions
5. Remove inactive accounts

## Security Checklist for Production

- [ ] All environment variables configured with strong values
- [ ] JWT_SECRET is at least 32 characters
- [ ] Database passwords are strong and unique
- [ ] HTTPS is enabled
- [ ] CORS is configured with specific origins (not wildcard)
- [ ] Rate limiting is enabled
- [ ] Database connections use SSL/TLS
- [ ] Error messages don't expose sensitive information
- [ ] File uploads are restricted to allowed types
- [ ] Logs are monitored regularly
- [ ] Backup strategy is implemented
- [ ] Dependencies are up to date
- [ ] Default admin password has been changed

## Security Updates

We regularly update dependencies and address security vulnerabilities. To update:

```bash
# Check for vulnerabilities
npm audit

# Update dependencies
npm update

# Fix vulnerabilities (may include breaking changes)
npm audit fix

# For major version updates
npm outdated
```

## Incident Response

In case of a security incident:

1. Immediately notify the security team at security@teleos.com
2. Document the incident details
3. Isolate affected systems if necessary
4. Preserve logs and evidence
5. Follow the incident response plan
6. Notify affected users if personal data was compromised

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)

## Version History

- **2.0.0** (2024): Comprehensive security improvements
  - Added rate limiting
  - Implemented input validation and sanitization
  - Enhanced file upload security
  - Removed hardcoded credentials
  - Enabled TypeScript strict mode
  - Added security middleware

- **1.0.0** (2023): Initial release
  - Basic JWT authentication
  - Role-based access control
  - Password hashing
