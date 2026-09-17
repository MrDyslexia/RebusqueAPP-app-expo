import { appConfig } from '@/config/app-config';
import { type ConductorApi } from '@/services/conductor-api';
import { fixtureConductorApi } from '@/services/fixture-conductor-api';
import { httpConductorApi } from '@/services/http-conductor-api';

export function getConductorApi(): ConductorApi {
  return appConfig.fixturesEnabled ? fixtureConductorApi : httpConductorApi;
}
