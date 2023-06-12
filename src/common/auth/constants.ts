export const developmentJwtOptions = {
  global: true,
  secret: 'development only!',
  signOptions: { expiresIn: '24h' },
};
