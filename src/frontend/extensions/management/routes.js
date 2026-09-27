export const managementRoutes = [
  {
    path: "/management/users",
    name: "ManagementUsers",
    component: () => import("./views/Users.vue"),
  },
];
