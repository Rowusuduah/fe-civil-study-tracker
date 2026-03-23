/**
 * FE Civil Syllabus Seed Data
 * 14 subjects → topics → subtopics
 * examWeight: approximate proportion of NCEES FE Civil exam
 * isFoundational: true = other topics depend on this
 * dependsOn: [] = prerequisite subject IDs
 */

const FE_CIVIL_SUBJECTS = [
  {
    id: 'mathematics',
    name: 'Mathematics and Statistics',
    shortName: 'Math & Stats',
    examWeight: 0.07,
    color: '#60a5fa',
    icon: '∑',
    topics: [
      {
        id: 'math_analytic_geometry',
        name: 'Analytic Geometry',
        isFoundational: true,
        dependsOn: [],
        subtopics: [
          { id: 'math_ag_lines', name: 'Lines, slopes, and intercepts' },
          { id: 'math_ag_circles', name: 'Circles and conic sections' },
          { id: 'math_ag_3d', name: 'Three-dimensional coordinate geometry' }
        ]
      },
      {
        id: 'math_calculus',
        name: 'Single-Variable Calculus',
        isFoundational: true,
        dependsOn: ['math_analytic_geometry'],
        subtopics: [
          { id: 'math_calc_limits', name: 'Limits and continuity' },
          { id: 'math_calc_derivatives', name: 'Derivatives and differentiation rules' },
          { id: 'math_calc_integrals', name: 'Definite and indefinite integrals' },
          { id: 'math_calc_applications', name: 'Applications: area, volume, optimization' }
        ]
      },
      {
        id: 'math_vectors',
        name: 'Vector Operations',
        isFoundational: true,
        dependsOn: [],
        subtopics: [
          { id: 'math_vec_dot', name: 'Dot product and cross product' },
          { id: 'math_vec_magnitude', name: 'Vector magnitude and direction' },
          { id: 'math_vec_resolve', name: 'Vector resolution and components' }
        ]
      },
      {
        id: 'math_statistics',
        name: 'Statistics',
        isFoundational: false,
        dependsOn: [],
        subtopics: [
          { id: 'math_stat_central', name: 'Mean, median, mode, standard deviation' },
          { id: 'math_stat_distributions', name: 'Probability distributions (normal, binomial)' },
          { id: 'math_stat_confidence', name: 'Confidence intervals and hypothesis testing' },
          { id: 'math_stat_regression', name: 'Linear regression and curve fitting' }
        ]
      }
    ]
  },

  {
    id: 'ethics',
    name: 'Ethics and Professional Practice',
    shortName: 'Ethics',
    examWeight: 0.07,
    color: '#a78bfa',
    icon: '⚖',
    topics: [
      {
        id: 'ethics_codes',
        name: 'Codes of Ethics',
        isFoundational: false,
        dependsOn: [],
        subtopics: [
          { id: 'ethics_nspe', name: 'NSPE Code of Ethics fundamentals' },
          { id: 'ethics_conflicts', name: 'Conflicts of interest and ethical dilemmas' },
          { id: 'ethics_obligations', name: 'Engineer obligations to public, clients, profession' }
        ]
      },
      {
        id: 'ethics_liability',
        name: 'Professional Liability',
        isFoundational: false,
        dependsOn: [],
        subtopics: [
          { id: 'ethics_negligence', name: 'Negligence and standard of care' },
          { id: 'ethics_torts', name: 'Torts and civil liability' },
          { id: 'ethics_indemnity', name: 'Indemnification and hold harmless' }
        ]
      },
      {
        id: 'ethics_licensure',
        name: 'Licensure',
        isFoundational: false,
        dependsOn: [],
        subtopics: [
          { id: 'ethics_pe_path', name: 'Path to licensure (EIT/FE → PE)' },
          { id: 'ethics_scope', name: 'Scope of practice and stamp authority' },
          { id: 'ethics_continuing', name: 'Continuing education requirements' }
        ]
      },
      {
        id: 'ethics_contracts',
        name: 'Contracts and Contract Law',
        isFoundational: false,
        dependsOn: [],
        subtopics: [
          { id: 'ethics_contract_types', name: 'Contract types: lump sum, cost-plus, unit price' },
          { id: 'ethics_contract_elements', name: 'Essential elements of a contract' },
          { id: 'ethics_contract_breach', name: 'Breach, remedies, and dispute resolution' }
        ]
      }
    ]
  },

  {
    id: 'economics',
    name: 'Engineering Economics',
    shortName: 'Eng. Economics',
    examWeight: 0.07,
    color: '#fbbf24',
    icon: '$',
    topics: [
      {
        id: 'econ_tvm',
        name: 'Time Value of Money',
        isFoundational: true,
        dependsOn: [],
        subtopics: [
          { id: 'econ_tvm_factors', name: 'P, F, A factors and interest tables' },
          { id: 'econ_tvm_npv', name: 'Net present value and future worth' },
          { id: 'econ_tvm_annuity', name: 'Annuities and uniform series' },
          { id: 'econ_tvm_gradient', name: 'Arithmetic and geometric gradients' }
        ]
      },
      {
        id: 'econ_costs',
        name: 'Costs',
        isFoundational: false,
        dependsOn: ['econ_tvm'],
        subtopics: [
          { id: 'econ_costs_types', name: 'Fixed, variable, sunk, and opportunity costs' },
          { id: 'econ_costs_depreciation', name: 'Depreciation methods (MACRS, SL, DDB)' },
          { id: 'econ_costs_capitalized', name: 'Capitalized cost and annual worth' }
        ]
      },
      {
        id: 'econ_analyses',
        name: 'Economic Analyses',
        isFoundational: false,
        dependsOn: ['econ_tvm', 'econ_costs'],
        subtopics: [
          { id: 'econ_breakeven', name: 'Break-even analysis' },
          { id: 'econ_bcr', name: 'Benefit-cost ratio analysis' },
          { id: 'econ_lcca', name: 'Life-cycle cost analysis' },
          { id: 'econ_irr', name: 'Internal rate of return (IRR)' },
          { id: 'econ_sustainability', name: 'Sustainability and renewable energy economics' }
        ]
      },
      {
        id: 'econ_uncertainty',
        name: 'Uncertainty and Risk',
        isFoundational: false,
        dependsOn: ['econ_tvm'],
        subtopics: [
          { id: 'econ_expected', name: 'Expected value and decision trees' },
          { id: 'econ_sensitivity', name: 'Sensitivity analysis' },
          { id: 'econ_risk', name: 'Risk assessment and contingency' }
        ]
      }
    ]
  },

  {
    id: 'statics',
    name: 'Statics',
    shortName: 'Statics',
    examWeight: 0.09,
    color: '#f87171',
    icon: '⊥',
    topics: [
      {
        id: 'stat_resultants',
        name: 'Resultants of Force Systems',
        isFoundational: true,
        dependsOn: ['mathematics'],
        subtopics: [
          { id: 'stat_res_2d', name: '2D force resultants and components' },
          { id: 'stat_res_3d', name: '3D force systems' },
          { id: 'stat_res_moments', name: 'Moments and couples' }
        ]
      },
      {
        id: 'stat_equilibrium',
        name: 'Equilibrium of Rigid Bodies',
        isFoundational: true,
        dependsOn: ['stat_resultants'],
        subtopics: [
          { id: 'stat_eq_2d', name: '2D equilibrium: ΣFx=0, ΣFy=0, ΣM=0' },
          { id: 'stat_eq_3d', name: '3D equilibrium conditions' },
          { id: 'stat_eq_reactions', name: 'Support reactions and free body diagrams' }
        ]
      },
      {
        id: 'stat_trusses',
        name: 'Frames and Trusses',
        isFoundational: true,
        dependsOn: ['stat_equilibrium'],
        subtopics: [
          { id: 'stat_truss_joints', name: 'Method of joints' },
          { id: 'stat_truss_sections', name: 'Method of sections' },
          { id: 'stat_frames', name: 'Frames and machines' }
        ]
      },
      {
        id: 'stat_centroid',
        name: 'Centroids and Moments of Inertia',
        isFoundational: true,
        dependsOn: ['math_calculus'],
        subtopics: [
          { id: 'stat_cent_area', name: 'Centroid of composite areas' },
          { id: 'stat_moi', name: 'Area moment of inertia (I)' },
          { id: 'stat_parallel_axis', name: 'Parallel axis theorem' },
          { id: 'stat_radius', name: 'Radius of gyration' }
        ]
      },
      {
        id: 'stat_friction',
        name: 'Static Friction',
        isFoundational: false,
        dependsOn: ['stat_equilibrium'],
        subtopics: [
          { id: 'stat_fric_coulomb', name: 'Coulomb friction law' },
          { id: 'stat_fric_wedge', name: 'Wedges and screws' },
          { id: 'stat_fric_belt', name: 'Belt and rope friction' }
        ]
      }
    ]
  },

  {
    id: 'dynamics',
    name: 'Dynamics',
    shortName: 'Dynamics',
    examWeight: 0.07,
    color: '#fb923c',
    icon: '⟹',
    topics: [
      {
        id: 'dyn_kinematics',
        name: 'Kinematics',
        isFoundational: true,
        dependsOn: ['statics', 'math_calculus'],
        subtopics: [
          { id: 'dyn_kin_linear', name: 'Linear kinematics: v, a, displacement' },
          { id: 'dyn_kin_projectile', name: 'Projectile motion' },
          { id: 'dyn_kin_rotation', name: 'Rotational kinematics: ω, α' },
          { id: 'dyn_kin_relative', name: 'Relative motion' }
        ]
      },
      {
        id: 'dyn_mass_inertia',
        name: 'Mass Moments of Inertia',
        isFoundational: false,
        dependsOn: ['stat_centroid'],
        subtopics: [
          { id: 'dyn_moi_shapes', name: 'Mass MOI for common shapes' },
          { id: 'dyn_moi_parallel', name: 'Parallel axis theorem for mass' }
        ]
      },
      {
        id: 'dyn_kinetics',
        name: 'Force and Acceleration',
        isFoundational: false,
        dependsOn: ['dyn_kinematics'],
        subtopics: [
          { id: 'dyn_kin_newton', name: "Newton's second law (F=ma)" },
          { id: 'dyn_kin_angular', name: 'Angular kinetics (ΣM=Iα)' },
          { id: 'dyn_kin_curvilinear', name: 'Curvilinear motion and normal/tangential components' }
        ]
      },
      {
        id: 'dyn_energy',
        name: 'Work, Energy, and Power',
        isFoundational: false,
        dependsOn: ['dyn_kinematics'],
        subtopics: [
          { id: 'dyn_wep_work', name: 'Work-energy theorem' },
          { id: 'dyn_wep_impulse', name: 'Impulse and momentum' },
          { id: 'dyn_wep_impact', name: 'Impact and coefficient of restitution' },
          { id: 'dyn_wep_power', name: 'Power and efficiency' }
        ]
      }
    ]
  },

  {
    id: 'mechanics',
    name: 'Mechanics of Materials',
    shortName: 'Mech. of Materials',
    examWeight: 0.09,
    color: '#2dd4bf',
    icon: '⊢',
    topics: [
      {
        id: 'mech_shear_moment',
        name: 'Shear and Moment Diagrams',
        isFoundational: true,
        dependsOn: ['stat_equilibrium'],
        subtopics: [
          { id: 'mech_sm_reactions', name: 'Beam reactions' },
          { id: 'mech_sm_shear', name: 'Shear force diagrams' },
          { id: 'mech_sm_moment', name: 'Bending moment diagrams' },
          { id: 'mech_sm_relations', name: 'Load-shear-moment relationships' }
        ]
      },
      {
        id: 'mech_stress_strain',
        name: 'Stresses and Strains',
        isFoundational: true,
        dependsOn: ['stat_equilibrium'],
        subtopics: [
          { id: 'mech_ss_normal', name: 'Normal stress (axial, bending)' },
          { id: 'mech_ss_shear', name: 'Shear stress (direct, torsion, transverse)' },
          { id: 'mech_ss_strain', name: 'Strain: normal and shear' },
          { id: 'mech_ss_hookes', name: "Hooke's law, E, G, ν (Poisson's ratio)" }
        ]
      },
      {
        id: 'mech_deformation',
        name: 'Deformations',
        isFoundational: false,
        dependsOn: ['mech_stress_strain'],
        subtopics: [
          { id: 'mech_def_axial', name: 'Axial deformation (δ = PL/AE)' },
          { id: 'mech_def_thermal', name: 'Thermal deformation' },
          { id: 'mech_def_torsion', name: 'Torsional deformation' },
          { id: 'mech_def_beam', name: 'Beam deflection (formula and superposition)' }
        ]
      },
      {
        id: 'mech_combined',
        name: 'Combined Stresses and Mohr\'s Circle',
        isFoundational: false,
        dependsOn: ['mech_stress_strain'],
        subtopics: [
          { id: 'mech_comb_principal', name: 'Principal stresses and max shear stress' },
          { id: 'mech_comb_mohrs', name: "Mohr's circle construction and reading" },
          { id: 'mech_comb_combined', name: 'Combined loading (axial + bending + torsion)' }
        ]
      }
    ]
  },

  {
    id: 'materials',
    name: 'Materials',
    shortName: 'Materials',
    examWeight: 0.05,
    color: '#f472b6',
    icon: '◈',
    topics: [
      {
        id: 'mat_concrete',
        name: 'Concrete',
        isFoundational: false,
        dependsOn: [],
        subtopics: [
          { id: 'mat_conc_mix', name: 'Mix design: w/c ratio, proportioning' },
          { id: 'mat_conc_properties', name: 'Compressive strength, workability, durability' },
          { id: 'mat_conc_tests', name: 'Slump test, compressive cylinder, air content' }
        ]
      },
      {
        id: 'mat_asphalt',
        name: 'Asphalt',
        isFoundational: false,
        dependsOn: [],
        subtopics: [
          { id: 'mat_asp_mix', name: 'Superpave and HMA mix design' },
          { id: 'mat_asp_properties', name: 'Viscosity, penetration, resilient modulus' },
          { id: 'mat_asp_tests', name: 'Marshall stability, density tests' }
        ]
      },
      {
        id: 'mat_steel',
        name: 'Metals and Steel',
        isFoundational: false,
        dependsOn: [],
        subtopics: [
          { id: 'mat_steel_properties', name: 'Yield strength, ultimate strength, ductility' },
          { id: 'mat_steel_harden', name: 'Heat treatment: hardening, tempering, annealing' },
          { id: 'mat_steel_corrosion', name: 'Corrosion and protection' }
        ]
      },
      {
        id: 'mat_aggregates',
        name: 'Aggregates and Wood',
        isFoundational: false,
        dependsOn: [],
        subtopics: [
          { id: 'mat_agg_grading', name: 'Gradation curves and sieve analysis' },
          { id: 'mat_agg_properties', name: 'Specific gravity, absorption, durability' },
          { id: 'mat_wood_properties', name: 'Wood: allowable stresses, moisture effects, species' }
        ]
      }
    ]
  },

  {
    id: 'fluid',
    name: 'Fluid Mechanics',
    shortName: 'Fluid Mechanics',
    examWeight: 0.09,
    color: '#38bdf8',
    icon: '≋',
    topics: [
      {
        id: 'fluid_properties',
        name: 'Fluid Properties',
        isFoundational: true,
        dependsOn: [],
        subtopics: [
          { id: 'fluid_prop_density', name: 'Density, specific weight, specific gravity' },
          { id: 'fluid_prop_viscosity', name: 'Viscosity: dynamic and kinematic' },
          { id: 'fluid_prop_surface', name: 'Surface tension and capillarity' }
        ]
      },
      {
        id: 'fluid_statics',
        name: 'Fluid Statics',
        isFoundational: false,
        dependsOn: ['fluid_properties', 'statics'],
        subtopics: [
          { id: 'fluid_stat_pressure', name: 'Hydrostatic pressure distribution' },
          { id: 'fluid_stat_forces', name: 'Forces on submerged surfaces' },
          { id: 'fluid_stat_buoyancy', name: 'Buoyancy and Archimedes principle' },
          { id: 'fluid_stat_manometer', name: 'Manometers and pressure gauges' }
        ]
      },
      {
        id: 'fluid_flow',
        name: 'Flow Measurement',
        isFoundational: false,
        dependsOn: ['fluid_properties'],
        subtopics: [
          { id: 'fluid_flow_continuity', name: 'Continuity equation' },
          { id: 'fluid_flow_bernoulli', name: 'Bernoulli equation and energy grade line' },
          { id: 'fluid_flow_venturi', name: 'Venturi, orifice, and pitot tube meters' },
          { id: 'fluid_flow_weir', name: 'Weirs and open-channel flow measurement' }
        ]
      },
      {
        id: 'fluid_energy',
        name: 'Energy, Impulse, and Momentum',
        isFoundational: false,
        dependsOn: ['fluid_flow'],
        subtopics: [
          { id: 'fluid_eim_energy', name: 'Energy equation with head loss (Darcy-Weisbach)' },
          { id: 'fluid_eim_momentum', name: 'Momentum equation for pipes and nozzles' },
          { id: 'fluid_eim_pipe', name: 'Pipe friction: Moody diagram, minor losses' },
          { id: 'fluid_eim_reynolds', name: 'Reynolds number and flow regimes' }
        ]
      }
    ]
  },

  {
    id: 'surveying',
    name: 'Surveying',
    shortName: 'Surveying',
    examWeight: 0.05,
    color: '#4ade80',
    icon: '⊿',
    topics: [
      {
        id: 'surv_angles',
        name: 'Angles, Distances, and Trigonometry',
        isFoundational: true,
        dependsOn: ['math_analytic_geometry'],
        subtopics: [
          { id: 'surv_ang_bearings', name: 'Bearings, azimuths, and angles' },
          { id: 'surv_ang_traverse', name: 'Traverse computations and closure' },
          { id: 'surv_ang_trig', name: 'Trigonometric leveling and EDM' }
        ]
      },
      {
        id: 'surv_area',
        name: 'Area Computations',
        isFoundational: false,
        dependsOn: ['surv_angles'],
        subtopics: [
          { id: 'surv_area_coordinate', name: 'Coordinate method (shoelace formula)' },
          { id: 'surv_area_trapezoidal', name: 'Trapezoidal and Simpson\'s rule' }
        ]
      },
      {
        id: 'surv_earthwork',
        name: 'Earthwork and Volume',
        isFoundational: false,
        dependsOn: ['surv_area'],
        subtopics: [
          { id: 'surv_earth_prismatoid', name: 'Prismatoid and average end area' },
          { id: 'surv_earth_cut_fill', name: 'Cut and fill volumes, mass haul' }
        ]
      },
      {
        id: 'surv_coordinates',
        name: 'Coordinate Systems',
        isFoundational: false,
        dependsOn: ['surv_angles'],
        subtopics: [
          { id: 'surv_coord_state_plane', name: 'State plane coordinate systems' },
          { id: 'surv_coord_gps', name: 'GPS and geodetic surveying basics' }
        ]
      },
      {
        id: 'surv_leveling',
        name: 'Leveling',
        isFoundational: false,
        dependsOn: ['surv_angles'],
        subtopics: [
          { id: 'surv_lev_differential', name: 'Differential leveling and benchmarks' },
          { id: 'surv_lev_profile', name: 'Profile leveling and cross-sections' },
          { id: 'surv_lev_errors', name: 'Error analysis and adjustment' }
        ]
      }
    ]
  },

  {
    id: 'water',
    name: 'Water Resources and Environmental Engineering',
    shortName: 'Water Resources',
    examWeight: 0.09,
    color: '#0ea5e9',
    icon: '💧',
    topics: [
      {
        id: 'water_hydrology',
        name: 'Basic Hydrology',
        isFoundational: true,
        dependsOn: ['math_statistics'],
        subtopics: [
          { id: 'water_hyd_hydrograph', name: 'Hydrographs: unit, composite, rational method' },
          { id: 'water_hyd_runoff', name: 'Runoff, CN method, infiltration' },
          { id: 'water_hyd_frequency', name: 'Flood frequency analysis and return periods' }
        ]
      },
      {
        id: 'water_hydraulics',
        name: 'Basic Hydraulics',
        isFoundational: false,
        dependsOn: ['fluid_flow', 'water_hydrology'],
        subtopics: [
          { id: 'water_hyd_open', name: 'Open-channel flow: Manning\'s equation' },
          { id: 'water_hyd_critical', name: 'Critical flow, hydraulic jump' },
          { id: 'water_hyd_culvert', name: 'Culvert design and performance' }
        ]
      },
      {
        id: 'water_pumps',
        name: 'Pumps',
        isFoundational: false,
        dependsOn: ['fluid_energy'],
        subtopics: [
          { id: 'water_pump_curves', name: 'Pump curves and system curves' },
          { id: 'water_pump_affinity', name: 'Affinity laws' },
          { id: 'water_pump_cavitation', name: 'NPSH and cavitation' }
        ]
      },
      {
        id: 'water_distribution',
        name: 'Water Distribution Systems',
        isFoundational: false,
        dependsOn: ['water_pumps'],
        subtopics: [
          { id: 'water_dist_design', name: 'Pipe network design and Hardy Cross' },
          { id: 'water_dist_pressure', name: 'Pressure zone and storage' },
          { id: 'water_dist_demand', name: 'Demand analysis and fire flow' }
        ]
      },
      {
        id: 'water_stormwater',
        name: 'Stormwater and Flood Control',
        isFoundational: false,
        dependsOn: ['water_hydrology'],
        subtopics: [
          { id: 'water_storm_detention', name: 'Detention and retention basins' },
          { id: 'water_storm_lids', name: 'LIDs and green infrastructure' },
          { id: 'water_storm_channels', name: 'Channel design and floodplain management' }
        ]
      },
      {
        id: 'water_treatment',
        name: 'Water and Wastewater Treatment',
        isFoundational: false,
        dependsOn: ['math_statistics'],
        subtopics: [
          { id: 'water_treat_quality', name: 'Water quality parameters and standards' },
          { id: 'water_treat_primary', name: 'Primary, secondary, tertiary treatment processes' },
          { id: 'water_treat_disinfection', name: 'Disinfection and CT calculations' },
          { id: 'water_treat_sludge', name: 'Sludge handling and biosolids' },
          { id: 'water_treat_groundwater', name: 'Groundwater: Darcy\'s law, well hydraulics' }
        ]
      }
    ]
  },

  {
    id: 'structural',
    name: 'Structural Engineering',
    shortName: 'Structural Eng.',
    examWeight: 0.09,
    color: '#c084fc',
    icon: '⌂',
    topics: [
      {
        id: 'struct_analysis',
        name: 'Structural Analysis (Determinate)',
        isFoundational: true,
        dependsOn: ['statics', 'mechanics'],
        subtopics: [
          { id: 'struct_an_beams', name: 'Statically determinate beams' },
          { id: 'struct_an_trusses', name: 'Statically determinate trusses' },
          { id: 'struct_an_frames', name: 'Frames and arches' },
          { id: 'struct_an_determinacy', name: 'Determinacy, stability, and indeterminacy' }
        ]
      },
      {
        id: 'struct_deflection',
        name: 'Deflection and Indeterminate Structures',
        isFoundational: false,
        dependsOn: ['struct_analysis', 'mech_deformation'],
        subtopics: [
          { id: 'struct_defl_formulas', name: 'Beam deflection formulas' },
          { id: 'struct_defl_superposition', name: 'Method of superposition' },
          { id: 'struct_indeterminate', name: 'Elementary indeterminate: 3-moment, moment distribution' }
        ]
      },
      {
        id: 'struct_loads',
        name: 'Loads and Load Combinations',
        isFoundational: false,
        dependsOn: [],
        subtopics: [
          { id: 'struct_loads_dead', name: 'Dead, live, and environmental loads' },
          { id: 'struct_loads_combo', name: 'ASCE 7 load combinations (LRFD and ASD)' },
          { id: 'struct_loads_path', name: 'Load paths and tributary area' }
        ]
      },
      {
        id: 'struct_steel',
        name: 'Steel Design',
        isFoundational: false,
        dependsOn: ['struct_analysis', 'struct_loads'],
        subtopics: [
          { id: 'struct_steel_tension', name: 'Tension members: Ag, Ae, block shear' },
          { id: 'struct_steel_compression', name: 'Compression: columns, KL/r, Euler buckling' },
          { id: 'struct_steel_beams', name: 'Beam design: Sx, Zx, lateral-torsional buckling' },
          { id: 'struct_steel_connections', name: 'Connections: bolts, welds, bearing' }
        ]
      },
      {
        id: 'struct_concrete',
        name: 'Reinforced Concrete Design',
        isFoundational: false,
        dependsOn: ['struct_analysis', 'struct_loads', 'mat_concrete'],
        subtopics: [
          { id: 'struct_conc_beams', name: 'Beam design: flexure, As, ρ, strength' },
          { id: 'struct_conc_shear', name: 'Shear design: stirrups and Vc' },
          { id: 'struct_conc_columns', name: 'Column design: tied and spiral' },
          { id: 'struct_conc_slab', name: 'One-way slab design' }
        ]
      }
    ]
  },

  {
    id: 'geotechnical',
    name: 'Geotechnical Engineering',
    shortName: 'Geotechnical',
    examWeight: 0.09,
    color: '#a3e635',
    icon: '⊞',
    topics: [
      {
        id: 'geo_index',
        name: 'Index Properties and Classification',
        isFoundational: true,
        dependsOn: [],
        subtopics: [
          { id: 'geo_idx_phase', name: 'Phase relationships: e, n, Sr, γ, w' },
          { id: 'geo_idx_atterberg', name: 'Atterberg limits: LL, PL, PI' },
          { id: 'geo_idx_uscs', name: 'USCS and AASHTO soil classification' },
          { id: 'geo_idx_gradation', name: 'Particle size distribution and gradation' }
        ]
      },
      {
        id: 'geo_tests',
        name: 'Laboratory and Field Tests',
        isFoundational: false,
        dependsOn: ['geo_index'],
        subtopics: [
          { id: 'geo_test_compaction', name: 'Proctor compaction test' },
          { id: 'geo_test_permeability', name: 'Constant-head and falling-head permeability' },
          { id: 'geo_test_spt', name: 'Standard penetration test (SPT)' },
          { id: 'geo_test_consolidation', name: 'Consolidation test (oedometer)' }
        ]
      },
      {
        id: 'geo_stress',
        name: 'Effective Stress and Seepage',
        isFoundational: false,
        dependsOn: ['geo_index'],
        subtopics: [
          { id: 'geo_stress_total', name: 'Total stress, pore pressure, effective stress' },
          { id: 'geo_stress_seepage', name: 'Seepage: Darcy\'s law and flow nets' },
          { id: 'geo_stress_capillary', name: 'Capillary rise and tension' }
        ]
      },
      {
        id: 'geo_shear_strength',
        name: 'Shear Strength',
        isFoundational: true,
        dependsOn: ['geo_stress'],
        subtopics: [
          { id: 'geo_shear_mohr', name: "Mohr-Coulomb criterion: c, φ" },
          { id: 'geo_shear_tests', name: 'Direct shear, triaxial, and unconfined tests' },
          { id: 'geo_shear_total_eff', name: 'Total vs effective stress analysis' }
        ]
      },
      {
        id: 'geo_foundations',
        name: 'Foundations and Bearing Capacity',
        isFoundational: false,
        dependsOn: ['geo_shear_strength'],
        subtopics: [
          { id: 'geo_found_bearing', name: 'Bearing capacity: Terzaghi, Meyerhof' },
          { id: 'geo_found_types', name: 'Shallow and deep foundation types' },
          { id: 'geo_found_settlement', name: 'Settlement: elastic and consolidation' }
        ]
      },
      {
        id: 'geo_retaining',
        name: 'Retaining Structures and Slope Stability',
        isFoundational: false,
        dependsOn: ['geo_shear_strength'],
        subtopics: [
          { id: 'geo_ret_rankine', name: 'Rankine and Coulomb lateral earth pressure' },
          { id: 'geo_ret_walls', name: 'Retaining wall design and stability checks' },
          { id: 'geo_slope', name: 'Slope stability: infinite slope, circular failure' },
          { id: 'geo_stabilization', name: 'Soil stabilization: lime, cement, geosynthetics' }
        ]
      }
    ]
  },

  {
    id: 'transportation',
    name: 'Transportation Engineering',
    shortName: 'Transportation',
    examWeight: 0.05,
    color: '#facc15',
    icon: '⛙',
    topics: [
      {
        id: 'trans_geometric',
        name: 'Geometric Design',
        isFoundational: false,
        dependsOn: ['math_calculus', 'surv_angles'],
        subtopics: [
          { id: 'trans_geo_horizontal', name: 'Horizontal curves: R, L, T, Δ, PC, PT' },
          { id: 'trans_geo_vertical', name: 'Vertical curves: crest and sag, sight distance' },
          { id: 'trans_geo_crosssection', name: 'Cross-section elements and superelevation' }
        ]
      },
      {
        id: 'trans_pavement',
        name: 'Pavement System Design',
        isFoundational: false,
        dependsOn: ['mat_asphalt', 'geo_index'],
        subtopics: [
          { id: 'trans_pave_flexible', name: 'Flexible pavement: AASHTO design method' },
          { id: 'trans_pave_rigid', name: 'Rigid pavement: thickness design' },
          { id: 'trans_pave_maintenance', name: 'Pavement condition and rehabilitation' }
        ]
      },
      {
        id: 'trans_traffic',
        name: 'Traffic Capacity and Flow',
        isFoundational: false,
        dependsOn: ['math_statistics'],
        subtopics: [
          { id: 'trans_traf_fundamentals', name: 'Traffic flow: volume, speed, density (q=ku)' },
          { id: 'trans_traf_capacity', name: 'Level of service and highway capacity (HCM)' },
          { id: 'trans_traf_signals', name: 'Signal timing: cycle length, phase design' }
        ]
      },
      {
        id: 'trans_control',
        name: 'Traffic Control Devices',
        isFoundational: false,
        dependsOn: [],
        subtopics: [
          { id: 'trans_ctrl_mutcd', name: 'MUTCD signs, markings, and signals' },
          { id: 'trans_ctrl_sight', name: 'Stopping and passing sight distance' }
        ]
      },
      {
        id: 'trans_planning',
        name: 'Transportation Planning',
        isFoundational: false,
        dependsOn: ['math_statistics'],
        subtopics: [
          { id: 'trans_plan_4step', name: 'Four-step travel demand model' },
          { id: 'trans_plan_modes', name: 'Mode choice and trip generation' }
        ]
      }
    ]
  },

  {
    id: 'construction',
    name: 'Construction Engineering',
    shortName: 'Construction',
    examWeight: 0.03,
    color: '#e2e8f0',
    icon: '🔨',
    topics: [
      {
        id: 'const_admin',
        name: 'Project Administration',
        isFoundational: false,
        dependsOn: ['ethics'],
        subtopics: [
          { id: 'const_admin_contracts', name: 'Contract documents: plans, specs, addenda' },
          { id: 'const_admin_submittals', name: 'Submittals, RFIs, and change orders' },
          { id: 'const_admin_safety', name: 'Safety regulations: OSHA basics' }
        ]
      },
      {
        id: 'const_operations',
        name: 'Construction Operations and Methods',
        isFoundational: false,
        dependsOn: [],
        subtopics: [
          { id: 'const_ops_equipment', name: 'Equipment selection and productivity' },
          { id: 'const_ops_concrete', name: 'Concrete placement and curing' },
          { id: 'const_ops_earthwork', name: 'Earthwork operations and compaction control' }
        ]
      },
      {
        id: 'const_controls',
        name: 'Project Controls and Estimating',
        isFoundational: false,
        dependsOn: ['economics'],
        subtopics: [
          { id: 'const_ctrl_schedule', name: 'CPM scheduling: critical path, float' },
          { id: 'const_ctrl_earned', name: 'Earned value analysis: SPI, CPI, EV' },
          { id: 'const_est_quantity', name: 'Quantity takeoff and unit cost estimating' }
        ]
      },
      {
        id: 'const_drawings',
        name: 'Engineering Drawing Interpretation',
        isFoundational: false,
        dependsOn: [],
        subtopics: [
          { id: 'const_draw_plan', name: 'Plan, profile, and section views' },
          { id: 'const_draw_symbols', name: 'Drawing symbols and abbreviations' }
        ]
      }
    ]
  }
];

/**
 * Flatten all subtopics to a single array for easy iteration
 */
function getAllSubtopics() {
  const result = [];
  FE_CIVIL_SUBJECTS.forEach(subject => {
    subject.topics.forEach(topic => {
      topic.subtopics.forEach(sub => {
        result.push({
          ...sub,
          subjectId: subject.id,
          subjectName: subject.name,
          topicId: topic.id,
          topicName: topic.name,
          examWeight: subject.examWeight,
          isFoundational: topic.isFoundational,
          dependsOn: topic.dependsOn
        });
      });
    });
  });
  return result;
}

/**
 * Get subject by ID
 */
function getSubjectById(id) {
  return FE_CIVIL_SUBJECTS.find(s => s.id === id) || null;
}

/**
 * Count total subtopics
 */
function getTotalSubtopicCount() {
  return getAllSubtopics().length;
}

if (typeof module !== 'undefined') module.exports = { FE_CIVIL_SUBJECTS, getAllSubtopics, getSubjectById, getTotalSubtopicCount };
