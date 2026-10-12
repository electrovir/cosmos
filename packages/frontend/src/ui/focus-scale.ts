/** How far out the view is, from one body up close to the whole universe. */
export enum FocusScale {
    /** One body up close. Its URL names the body's kind instead, like `planet`. */
    Body = 'body',
    /** A planet and the moons around it. */
    Moons = 'moons',
    System = 'system',
    Galaxy = 'galaxy',
    /** The galaxies around the anchor's own, like the Local Group. */
    Group = 'group',
    Universe = 'universe',
}
