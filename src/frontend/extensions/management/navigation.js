const routes = ['/management/users', '/management/machines'];
export const managementReturnPath = value => typeof value === 'string' && routes.includes(value) ? value : null;
export const isManagementHash = hash => managementReturnPath(String(hash).split('?')[0].replace(/^#/, '')) !== null;
export const managementLoginRoute = path => ({path:'/admin', query:{returnTo:managementReturnPath(path) || '/management/users'}});
