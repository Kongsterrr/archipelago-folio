// Campus architecture is separate from Jack's academic history. These authored
// facts are shared by the scene panel and its non-3D reading route.
const freeze = value => {
 if(value && typeof value === 'object') {
  for(const child of Object.values(value)) freeze(child);
  Object.freeze(value);
 }
 return value;
};

export const campusLandmarks = freeze([
 {
  id:'duan-center',
  schoolId:'bu',
  islandId:'education',
  title:'Duan Family Center for Computing & Data Sciences',
  shortName:'Duan Center',
  summary:'A contemporary Boston University landmark where offset building volumes, planted terraces, and shaded glass bring computing and data science into the campus skyline.',
  sections:[
   {
    title:'A changing skyline',
    body:'The center opened on December 8, 2022, and received its current name in December 2024. KPMB designed projecting volumes around a central core, creating terraces and a distinctive stepped silhouette.'
   },
   {
    title:'Sunlight and ground heat',
    body:'Exterior louvers control sunlight and glare. A closed-loop geothermal system exchanges heat with the ground to warm and cool the building, which operates without a gas connection.'
   },
   {
    title:'Spaces to meet',
    body:'An atrium, connecting stairs, and shared work areas encourage people from different departments to meet. Flexible classrooms and gathering spaces support learning, research, and collaboration.'
   }
  ],
  note:"This is a campus landmark, not a claim that Jack studied in this building. Jack graduated from Boston University in May 2022, before the center opened.",
  sources:[
   {label:'Boston University · Building history and sustainability',url:'https://www.bu.edu/cds-faculty/explore/bu-center-for-computing-data-sciences/'},
   {label:'KPMB · Architecture and design',url:'https://www.kpmb.com/project/duan-family-center-for-computing-data-sciences-at-boston-university/'}
  ]
 }
]);

/** Stable landmark lookup; unknown IDs do not open unrelated academic content. */
export function getCampusLandmark(id) {
 return campusLandmarks.find(landmark=>landmark.id===id) ?? null;
}

// These are conceptual exhibit themes, not live building performance data.
export const duanThemes = freeze([
 {id:'sunlight',title:'Sunlight',description:'Facade louvers filter direct sun while allowing daylight into the building.'},
 {id:'ground-heat',title:'Ground heat',description:'A closed-loop geothermal system exchanges heat with the ground for heating and cooling.'},
 {id:'collaboration',title:'Collaboration',description:'Shared spaces and connected stairs bring learning and research communities together.'}
]);
