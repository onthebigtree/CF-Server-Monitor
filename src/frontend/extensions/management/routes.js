export const managementRoutes = [
  {path:"/management/machines",name:"ManagementMachines",component:()=>import("./views/Machines.vue")},
  {
    path: "/management/users",
    name: "ManagementUsers",
    component: () => import("./views/Users.vue"),
  },
];
