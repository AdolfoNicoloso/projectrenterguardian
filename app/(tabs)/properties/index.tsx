import { Redirect } from 'expo-router';
import { Routes } from '../../../src/navigation/routes';

/** Legacy Home route — keep nested property stack; list lives under Rents / Tours tabs. */
export default function PropertiesIndexRedirect() {
  return <Redirect href={Routes.RENTS.LIST} />;
}
