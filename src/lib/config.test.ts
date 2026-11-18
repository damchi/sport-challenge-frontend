import { readConfig } from './config';

describe('readConfig', () => {
  it('reads the API address without its trailing slash', () => {
    expect(readConfig({ VITE_API_URL: 'https://api.example.com/' })).toEqual({
      apiUrl: 'https://api.example.com',
    });
  });

  it('fails clearly when VITE_API_URL is missing', () => {
    expect(() => readConfig({})).toThrow('VITE_API_URL is missing');
    expect(() => readConfig({ VITE_API_URL: '' })).toThrow('VITE_API_URL is missing');
  });

  it('accepts plain http only in development or to the local machine', () => {
    expect(readConfig({ VITE_API_URL: 'http://localhost:8080' }).apiUrl).toBe(
      'http://localhost:8080',
    );
    expect(readConfig({ VITE_API_URL: 'http://192.168.1.10:8080', DEV: true }).apiUrl).toBe(
      'http://192.168.1.10:8080',
    );
    expect(() => readConfig({ VITE_API_URL: 'http://api.example.com', DEV: false })).toThrow(
      'must use https outside development',
    );
  });

  it('fails when VITE_API_URL is not an http(s) address', () => {
    expect(() => readConfig({ VITE_API_URL: 'api.example.com' })).toThrow('not an http(s) address');
    expect(() => readConfig({ VITE_API_URL: 'ftp://api.example.com' })).toThrow(
      'not an http(s) address',
    );
  });
});
