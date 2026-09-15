-- ArtisanGH — 0004 reference data
--
-- Categories, transport zone bands and operational settings. Idempotent, so it
-- is safe to re-run. Transport fees here are PLACEHOLDERS — the client confirms
-- real Accra/Tema numbers before go-live (PLAN.md §16).

-- ---------------------------------------------------------------------------
-- Service categories
-- ---------------------------------------------------------------------------

insert into public.categories (name, slug, icon, description, sort_order) values
  ('Electrical',                  'electrical',           'zap',          'Wiring, sockets, lighting, fuse boards, faults', 10),
  ('Plumbing',                    'plumbing',             'droplets',     'Leaks, pipes, taps, toilets, water pressure', 20),
  ('AC & Refrigeration',          'ac-refrigeration',     'snowflake',    'Air conditioner install, servicing, gas refill, fridges', 30),
  ('Carpentry',                   'carpentry',            'hammer',       'Doors, wardrobes, furniture repair, fittings', 40),
  ('Painting',                    'painting',             'paint-roller', 'Interior and exterior painting, touch-ups', 50),
  ('Cleaning',                    'cleaning',             'sparkles',     'Deep cleaning, post-construction, move-in and move-out', 60),
  ('Masonry & Tiling',            'masonry-tiling',       'brick-wall',   'Block work, plastering, floor and wall tiles', 70),
  ('Welding & Metalwork',         'welding-metalwork',    'flame',        'Gates, burglar-proofing, railings, repairs', 80),
  ('Appliance Repair',            'appliance-repair',     'washing-machine', 'Washing machines, microwaves, cookers, TVs', 90),
  ('Generator Repair',            'generator-repair',     'fuel',         'Generator servicing, repair and installation', 100),
  ('Roofing',                     'roofing',              'home',         'Leaks, sheet replacement, gutters, ceilings', 110),
  ('Aluminium & Glass',           'aluminium-glass',      'square',       'Windows, sliding doors, shopfronts, glazing', 120),
  ('CCTV & Security',             'cctv-security',        'cctv',         'Cameras, alarms, intercoms, electric fencing', 130),
  ('Pest Control',                'pest-control',         'bug',          'Fumigation, termites, rodents, mosquitoes', 140),
  ('Landscaping & Gardening',     'landscaping',          'trees',        'Lawn care, hedging, garden design, clearing', 150),
  ('Borehole & Water Systems',    'borehole-water',       'waves',        'Pumps, polytanks, filtration, boreholes', 160),
  ('POP & Ceiling Works',         'pop-ceiling',          'layout-panel-top', 'POP designs, ceiling installation and repair', 170),
  ('Upholstery',                  'upholstery',           'sofa',         'Sofa recovering, cushions, foam replacement', 180),
  ('Curtains & Blinds',           'curtains-blinds',      'blinds',       'Measuring, sewing, rails and installation', 190),
  ('Locksmith',                   'locksmith',            'key-round',    'Lock fitting, lockouts, key cutting, padlocks', 200),
  ('Satellite & TV Installation', 'satellite-tv',         'satellite-dish', 'Dish alignment, decoders, wall mounting', 210),
  ('Solar Installation',          'solar',                'sun',          'Panels, inverters, batteries, maintenance', 220),
  ('Mobile Auto Mechanic',        'auto-mechanic',        'car',          'Roadside and at-home vehicle servicing and repair', 230),
  ('Interior Fit-out',            'interior-fitout',      'ruler',        'Partitioning, shelving, full room finishing', 240),
  ('Tailoring',                   'tailoring',            'scissors',     'Alterations, repairs, custom sewing at home', 250),
  ('Hair & Beauty (Home)',        'hair-beauty',          'scissors-line-dashed', 'Home-service braiding, barbering, nails, makeup', 260)
on conflict (slug) do update
  set name        = excluded.name,
      icon        = excluded.icon,
      description = excluded.description,
      sort_order  = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- Transport zones (PLACEHOLDER VALUES — confirm with client before go-live)
-- ---------------------------------------------------------------------------
-- provider_share_pct is 100 across the board: the transport fee passes to the
-- artisan in full. It is a cost reimbursement, not platform revenue.

insert into public.transport_zones (city, min_km, max_km, fee, provider_share_pct)
select * from (values
  ('*',      0.00,   5.00,   20.00, 100.00),
  ('*',      5.00,  15.00,   40.00, 100.00),
  ('*',     15.00,  30.00,   60.00, 100.00),
  ('*',     30.00, 100.00,  100.00, 100.00)
) as v(city, min_km, max_km, fee, provider_share_pct)
where not exists (select 1 from public.transport_zones);

-- ---------------------------------------------------------------------------
-- Operational settings
-- ---------------------------------------------------------------------------
-- All tunable by the client's admin without a deploy. Reliability thresholds
-- are the starting numbers from PLAN.md §8.

insert into public.settings (key, value, description) values
  ('platform_commission_pct', '12'::jsonb,
   'Percent added on top of the artisan quote. The platform''s only revenue line.'),

  ('deposit_pct', '50'::jsonb,
   'Percent of the marked-up total collected before the artisan travels.'),

  ('offer_timeout_seconds', '120'::jsonb,
   'How long a single artisan has to accept an offer before it passes on.'),

  ('matching_radius_passes', '[5, 10, 20]'::jsonb,
   'Radius in km for each successive matching pass before falling through to admin.'),

  ('max_quote_rejections', '3'::jsonb,
   'Quote rejections before a job stops rematching and offers an admin callback.'),

  ('min_job_value_ghs', '80'::jsonb,
   'Below this the payout transfer fee makes the economics unworkable.'),

  ('reliability', jsonb_build_object(
      'window_days',                 30,
      'min_offers_before_scoring',   5,
      'accept_rate_deprioritise',    40,
      'accept_rate_review',          20,
      'cancel_after_accept_suspend', 3,
      'no_show_suspend',             2,
      'no_show_hours',               2,
      'rating_review_below',         3.0,
      'rating_review_min_jobs',      5,
      'rating_suspend_below',        2.5,
      'rating_suspend_min_jobs',     10
   ),
   'Artisan reliability thresholds. Suspension always requires an admin to reinstate.'),

  ('support_phone', '"+233000000000"'::jsonb,
   'Shown to users when a job stalls or a dispute is raised. Replace before launch.')
on conflict (key) do nothing;
