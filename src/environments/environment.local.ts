export const environment = {
  production: false,
  DIPLOMAS_SERVICE: {
    // Local requests must reach the MF proxy, even when mounted by root on 4200.
    BASE_URL: 'http://localhost:4227/v1'
  }
};
