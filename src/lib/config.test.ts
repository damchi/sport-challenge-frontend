import { readConfig } from './config';

const env = {
  VITE_API_URL: 'https://api.example.com',
  VITE_AUTH0_DOMAIN: 'sport-challenge-dev.ca.auth0.com',
  VITE_AUTH0_CLIENT_ID: 'client-id',
  VITE_AUTH0_AUDIENCE: 'https://api.dev.sport-challenge',
};

describe('readConfig', () => {
  it('reads the API address without its trailing slash, and the Auth0 settings', () => {
    expect(readConfig({ ...env, VITE_API_URL: 'https://api.example.com/' })).toEqual({
      apiUrl: 'https://api.example.com',
      auth0: {
        domain: 'sport-challenge-dev.ca.auth0.com',
        clientId: 'client-id',
        audience: 'https://api.dev.sport-challenge',
      },
    });
  });

  it.each(['VITE_API_URL', 'VITE_AUTH0_DOMAIN', 'VITE_AUTH0_CLIENT_ID', 'VITE_AUTH0_AUDIENCE'])(
    'fails clearly when %s is missing',
    (name) => {
      expect(() => readConfig({ ...env, [name]: undefined })).toThrow(`${name} is missing`);
      expect(() => readConfig({ ...env, [name]: '' })).toThrow(`${name} is missing`);
    },
  );

  it('wants the Auth0 domain as a bare host name', () => {
    expect(() =>
      readConfig({ ...env, VITE_AUTH0_DOMAIN: 'https://sport-challenge-dev.ca.auth0.com' }),
    ).toThrow('must be a host name');
  });

  it('accepts plain http only in development or to the local machine', () => {
    expect(readConfig({ ...env, VITE_API_URL: 'http://localhost:8080' }).apiUrl).toBe(
      'http://localhost:8080',
    );
    expect(readConfig({ ...env, VITE_API_URL: 'http://192.168.1.10:8080', DEV: true }).apiUrl).toBe(
      'http://192.168.1.10:8080',
    );
    expect(() =>
      readConfig({ ...env, VITE_API_URL: 'http://api.example.com', DEV: false }),
    ).toThrow('must use https outside development');
  });

  it('fails when VITE_API_URL is not an http(s) address', () => {
    expect(() => readConfig({ ...env, VITE_API_URL: 'api.example.com' })).toThrow(
      'not an http(s) address',
    );
    expect(() => readConfig({ ...env, VITE_API_URL: 'ftp://api.example.com' })).toThrow(
      'not an http(s) address',
    );
  });
});
