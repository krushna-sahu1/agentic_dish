-- =============================================================================
-- Seed: Agentic Dish — South Indian & Odia kitchen, Bhubaneswar.
-- Demo logins (test-only credentials, see README):
--   owner@example.com / Owner@12345
--   staff@example.com / Staff@12345
--   customer@example.com / Customer@12345   (peanut allergy, for allergy flow)
-- Generates ~90 days of synthetic orders, payments, timelines and reviews.
-- =============================================================================

select set_config('app.payment_context', 'seed', false);
select setseed(0.42);

-- ---------------------------------------------------------------------------
-- Restaurant settings
-- ---------------------------------------------------------------------------
insert into public.restaurant_settings (
  name, tagline, phone, email, address, lat, lng, timezone, opening_hours,
  delivery_radius_km, serviceable_pincodes, delivery_fee_paise, free_delivery_above_paise,
  packaging_fee_paise, gst_percent, min_order_paise, avg_prep_minutes, accepting_orders, announcement
) values (
  'Agentic Dish',
  'Crisp dosas, Odia comfort food, served with a smile.',
  '+91 674 255 0142',
  'hello@agenticdish.example',
  'Plot 42, Saheed Nagar, Bhubaneswar, Odisha 751007',
  20.2906, 85.8446, 'Asia/Kolkata',
  '{
    "mon": [{"open": "07:00", "close": "15:30"}, {"open": "17:30", "close": "23:00"}],
    "tue": [{"open": "07:00", "close": "15:30"}, {"open": "17:30", "close": "23:00"}],
    "wed": [{"open": "07:00", "close": "15:30"}, {"open": "17:30", "close": "23:00"}],
    "thu": [{"open": "07:00", "close": "15:30"}, {"open": "17:30", "close": "23:00"}],
    "fri": [{"open": "07:00", "close": "15:30"}, {"open": "17:30", "close": "23:30"}],
    "sat": [{"open": "07:00", "close": "23:30"}],
    "sun": [{"open": "07:00", "close": "23:30"}]
  }'::jsonb,
  6, array['751001','751002','751003','751006','751007','751009','751010','751012','751013','751014','751015','751016','751022','751024'],
  3000, 49900, 1500, 5, 10000, 20, true,
  'New: Odia Specials are now available all day! Try our Dahibara Aloodum.'
);

-- ---------------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------------
insert into public.categories (name, slug, sort_order) values
  ('Dosa', 'dosa', 1),
  ('Idli & Vada', 'idli-vada', 2),
  ('Uttapam', 'uttapam', 3),
  ('Rice', 'rice', 4),
  ('Odia Specials', 'odia-specials', 5),
  ('Snacks', 'snacks', 6),
  ('Beverages', 'beverages', 7),
  ('Desserts', 'desserts', 8);

-- ---------------------------------------------------------------------------
-- Menu items (prices in rupees here, stored as paise)
-- ---------------------------------------------------------------------------
insert into public.menu_items (
  category_id, name, slug, description, price_paise, image_url, is_veg, is_vegan, is_jain,
  spice_level, allergens, tags, calories, prep_time_min, portion, stock_qty, low_stock_threshold, sort_order
)
select c.id, v.name, v.slug, v.description, v.price * 100, '/dishes/' || v.img || '.svg',
       v.is_veg, v.is_vegan, v.is_jain, v.spice, v.allergens::text[], v.tags::text[],
       v.calories, v.prep, v.portion, v.stock::int, v.low, v.sort
from (values
  -- Dosa
  ('dosa', 'Plain Dosa', 'plain-dosa', 'Thin, golden rice-and-urad crepe served with coconut chutney and sambar.', 90, 'dosa', true, true, false, 1, '{}', '{}', 280, 10, '1 dosa (12 inch)', null, 5, 1),
  ('dosa', 'Masala Dosa', 'masala-dosa', 'Crisp dosa folded around spiced potato-onion masala. Our all-time favourite.', 120, 'dosa', true, false, false, 2, '{}', '{bestseller}', 380, 12, '1 dosa', null, 5, 2),
  ('dosa', 'Paneer Masala Dosa', 'paneer-masala-dosa', 'Crisp dosa stuffed with spiced crumbled paneer and potato masala.', 170, 'dosa', true, false, false, 2, '{dairy}', '{bestseller,chef_special}', 480, 14, '1 dosa', null, 5, 3),
  ('dosa', 'Mysore Masala Dosa', 'mysore-masala-dosa', 'Fiery red garlic chutney smeared inside, filled with potato masala.', 150, 'dosa', true, true, false, 4, '{}', '{bestseller}', 420, 14, '1 dosa', null, 5, 4),
  ('dosa', 'Ghee Roast Dosa', 'ghee-roast-dosa', 'Paper-thin, extra-crisp dosa roasted in pure ghee.', 150, 'dosa', true, false, true, 1, '{dairy}', '{chef_special}', 400, 12, '1 dosa', null, 5, 5),
  ('dosa', 'Rava Dosa', 'rava-dosa', 'Lacy semolina dosa with green chilli, ginger and cumin.', 130, 'dosa', true, true, false, 2, '{gluten}', '{}', 330, 15, '1 dosa', null, 5, 6),
  ('dosa', 'Onion Rava Dosa', 'onion-rava-dosa', 'Lacy semolina dosa loaded with crisp onions and green chillies.', 140, 'dosa', true, true, false, 2, '{gluten}', '{}', 350, 15, '1 dosa', null, 5, 7),
  ('dosa', 'Cheese Dosa', 'cheese-dosa', 'Golden dosa blanketed with melted cheese. A kids'' favourite.', 160, 'dosa', true, false, true, 1, '{dairy}', '{kids}', 450, 12, '1 dosa', null, 5, 8),
  ('dosa', 'Set Dosa', 'set-dosa', 'Three soft, spongy dosas with vegetable sagu and chutney.', 110, 'dosa', true, true, false, 1, '{}', '{healthy}', 360, 12, '3 dosas', null, 5, 9),
  ('dosa', 'Spring Dosa', 'spring-dosa', 'Dosa rolled with schezwan-tossed vegetables. Indo-Chinese fun.', 160, 'dosa', true, true, false, 3, '{soy,gluten}', '{new,kids}', 410, 15, '1 dosa', null, 5, 10),
  ('dosa', 'Egg Dosa', 'egg-dosa', 'Dosa topped with a beaten egg, black pepper and onions.', 130, 'dosa', false, false, false, 2, '{egg}', '{}', 390, 12, '1 dosa', null, 5, 11),
  -- Idli & Vada
  ('idli-vada', 'Idli', 'idli', 'Steamed, cloud-soft rice cakes with chutney and sambar.', 60, 'idli', true, true, false, 1, '{}', '{healthy,kids}', 160, 8, '2 pcs', null, 5, 1),
  ('idli-vada', 'Ghee Podi Idli', 'ghee-podi-idli', 'Mini idlis tossed in ghee and spicy gunpowder podi.', 100, 'idli', true, false, false, 3, '{dairy,sesame}', '{chef_special}', 320, 10, '14 mini idlis', null, 5, 2),
  ('idli-vada', 'Medu Vada', 'medu-vada', 'Crisp-outside, fluffy-inside lentil doughnuts.', 70, 'vada', true, true, false, 1, '{}', '{bestseller}', 300, 10, '2 pcs', null, 5, 3),
  ('idli-vada', 'Sambar Vada', 'sambar-vada', 'Medu vada soaked in hot tiffin sambar.', 85, 'vada', true, true, false, 2, '{}', '{}', 330, 10, '2 pcs', null, 5, 4),
  ('idli-vada', 'Rasam Vada', 'rasam-vada', 'Medu vada dunked in peppery tomato rasam.', 85, 'vada', true, true, false, 3, '{}', '{}', 300, 10, '2 pcs', null, 5, 5),
  ('idli-vada', 'Dahi Vada', 'dahi-vada', 'Soft vadas in lightly sweetened curd with mustard tempering.', 90, 'vada', true, false, false, 1, '{dairy}', '{}', 340, 8, '2 pcs', null, 5, 6),
  ('idli-vada', 'Idli Vada Combo', 'idli-vada-combo', 'Two idlis and one medu vada with chutneys and sambar.', 95, 'idli', true, true, false, 1, '{}', '{bestseller,kids}', 380, 10, '2 idli + 1 vada', null, 5, 7),
  -- Uttapam
  ('uttapam', 'Onion Uttapam', 'onion-uttapam', 'Thick, soft rice pancake topped with onions and green chillies.', 120, 'uttapam', true, true, false, 2, '{}', '{}', 340, 14, '1 uttapam', null, 5, 1),
  ('uttapam', 'Tomato Uttapam', 'tomato-uttapam', 'Thick rice pancake topped with juicy tomatoes and coriander.', 120, 'uttapam', true, true, true, 1, '{}', '{}', 320, 14, '1 uttapam', null, 5, 2),
  ('uttapam', 'Mixed Veg Uttapam', 'mixed-veg-uttapam', 'Loaded with carrots, capsicum, onion, tomato and coriander.', 140, 'uttapam', true, true, false, 2, '{}', '{healthy}', 360, 15, '1 uttapam', null, 5, 3),
  ('uttapam', 'Podi Uttapam', 'podi-uttapam', 'Uttapam dusted with spicy gunpowder podi and drizzled with oil.', 130, 'uttapam', true, true, false, 3, '{sesame}', '{}', 370, 14, '1 uttapam', null, 5, 4),
  ('uttapam', 'Cheese Chilli Uttapam', 'cheese-chilli-uttapam', 'Uttapam with green chillies under a layer of melted cheese.', 160, 'uttapam', true, false, false, 3, '{dairy}', '{new}', 450, 15, '1 uttapam', null, 5, 5),
  -- Rice
  ('rice', 'Curd Rice', 'curd-rice', 'Creamy curd rice tempered with mustard, curry leaves and pomegranate. The ultimate cooler.', 110, 'rice', true, false, true, 0, '{dairy}', '{healthy}', 320, 8, '1 bowl', null, 5, 1),
  ('rice', 'Lemon Rice', 'lemon-rice', 'Tangy turmeric rice with roasted peanuts and curry leaves.', 100, 'rice', true, true, false, 1, '{peanut}', '{}', 340, 8, '1 bowl', null, 5, 2),
  ('rice', 'Bisi Bele Bath', 'bisi-bele-bath', 'Karnataka-style lentil, rice and vegetable one-pot with ghee and boondi.', 140, 'rice', true, false, false, 2, '{dairy}', '{chef_special}', 450, 10, '1 bowl', null, 5, 3),
  ('rice', 'Puliyogare', 'puliyogare', 'Tamarind rice with roasted peanuts, sesame and red chillies.', 110, 'rice', true, true, false, 3, '{peanut,sesame}', '{}', 380, 8, '1 bowl', null, 5, 4),
  ('rice', 'Chicken Biryani', 'chicken-biryani', 'Fragrant seeraga samba rice dum-cooked with spiced chicken.', 280, 'biryani', false, false, false, 3, '{dairy}', '{bestseller}', 720, 20, '1 plate', null, 5, 5),
  ('rice', 'Veg Biryani', 'veg-biryani', 'Seeraga samba rice dum-cooked with vegetables, mint and cashews.', 220, 'biryani', true, false, false, 2, '{dairy,nuts}', '{}', 600, 18, '1 plate', null, 5, 6),
  ('rice', 'Chettinad Chicken Curry & Rice', 'chettinad-chicken-rice', 'Bold black-pepper and kalpasi chicken curry with steamed rice.', 300, 'curry', false, false, false, 4, '{}', '{chef_special}', 680, 20, '1 plate', null, 5, 7),
  ('rice', 'Egg Curry & Rice', 'egg-curry-rice', 'Two boiled eggs in a tangy onion-tomato curry with steamed rice.', 200, 'curry', false, false, false, 3, '{egg}', '{}', 560, 15, '1 plate', null, 5, 8),
  -- Odia Specials
  ('odia-specials', 'Dalma', 'dalma', 'Odisha''s comforting toor dal with raw papaya, pumpkin and banana, finished with ghee.', 120, 'curry', true, false, false, 1, '{dairy}', '{healthy,bestseller}', 280, 10, '1 bowl + rice', null, 5, 1),
  ('odia-specials', 'Pakhala Bhata', 'pakhala-bhata', 'Fermented water rice with curd and roasted cumin, served with badi chura and fried aloo.', 140, 'rice', true, false, false, 1, '{dairy}', '{healthy}', 350, 8, '1 bowl', null, 5, 2),
  ('odia-specials', 'Santula', 'santula', 'Lightly spiced mixed-vegetable stew, Odia home style.', 110, 'curry', true, true, false, 1, '{}', '{healthy}', 180, 10, '1 bowl', null, 5, 3),
  ('odia-specials', 'Aloo Potala Rasa', 'aloo-potala-rasa', 'Pointed gourd and potato in a rich onion-tomato gravy.', 150, 'curry', true, true, false, 2, '{}', '{}', 300, 15, '1 bowl', null, 5, 4),
  ('odia-specials', 'Dahi Baigana', 'dahi-baigana', 'Fried brinjal in tempered, lightly sweet curd.', 130, 'curry', true, false, false, 1, '{dairy}', '{}', 260, 12, '1 bowl', null, 5, 5),
  ('odia-specials', 'Machha Besara', 'machha-besara', 'Rohu fish in a pungent mustard-garlic gravy.', 290, 'fish', false, false, false, 3, '{}', '{chef_special}', 420, 20, '2 pcs + gravy', null, 5, 6),
  ('odia-specials', 'Chingudi Malai Curry', 'chingudi-malai-curry', 'Prawns simmered in coconut milk with gentle spices.', 340, 'fish', false, false, false, 2, '{shellfish}', '{chef_special}', 480, 20, '1 bowl', 6, 5, 7),
  ('odia-specials', 'Mutton Kasa', 'mutton-kasa', 'Slow-cooked Odia-style mutton — dark, rich and spicy.', 380, 'curry', false, false, false, 4, '{}', '{}', 650, 25, '250 g', 4, 5, 8),
  -- Snacks
  ('snacks', 'Mirchi Bajji', 'mirchi-bajji', 'Big green chillies in gram-flour batter, fried crisp.', 70, 'snack', true, true, false, 4, '{}', '{}', 260, 10, '3 pcs', null, 5, 1),
  ('snacks', 'Onion Pakoda', 'onion-pakoda', 'Crunchy onion fritters with curry leaves.', 80, 'snack', true, true, false, 2, '{}', '{}', 300, 10, '1 plate', null, 5, 2),
  ('snacks', 'Mysore Bonda', 'mysore-bonda', 'Fluffy, crisp fritters made with yogurt and maida.', 70, 'snack', true, false, false, 1, '{dairy,gluten}', '{kids}', 290, 10, '4 pcs', null, 5, 3),
  ('snacks', 'Gobi 65', 'gobi-65', 'Crispy cauliflower fried in fiery red masala.', 160, 'snack', true, true, false, 4, '{gluten}', '{bestseller}', 380, 12, '1 plate', null, 5, 4),
  ('snacks', 'Chicken 65', 'chicken-65', 'Chennai''s famous spicy fried chicken with curry leaves.', 240, 'snack', false, false, false, 4, '{egg}', '{bestseller}', 520, 15, '1 plate', null, 5, 5),
  ('snacks', 'Gupchup', 'gupchup', 'Odisha''s pani puri — crisp shells with spicy, tangy water and potato-chana.', 60, 'snack', true, true, false, 3, '{gluten}', '{}', 220, 5, '6 pcs', null, 5, 6),
  ('snacks', 'Dahibara Aloodum', 'dahibara-aloodum', 'Cuttack street favourite — vadas in curd water with spicy aloo dum and ghuguni.', 90, 'snack', true, false, false, 3, '{dairy}', '{chef_special}', 380, 8, '1 bowl', null, 5, 7),
  -- Beverages
  ('beverages', 'Filter Coffee', 'filter-coffee', 'Strong decoction coffee with frothy hot milk, served in a dabara.', 50, 'coffee', true, false, true, 0, '{dairy}', '{bestseller}', 120, 5, '150 ml', null, 5, 1),
  ('beverages', 'Masala Chai', 'masala-chai', 'Milky tea brewed with ginger, cardamom and spices.', 40, 'coffee', true, false, true, 0, '{dairy}', '{}', 110, 5, '150 ml', null, 5, 2),
  ('beverages', 'Neer Mor', 'neer-mor', 'Spiced buttermilk with ginger, green chilli and curry leaves. Cools any spice.', 50, 'drink', true, false, false, 1, '{dairy}', '{healthy}', 60, 3, '250 ml', null, 5, 3),
  ('beverages', 'Sweet Lassi', 'sweet-lassi', 'Thick, chilled sweet yogurt drink.', 80, 'drink', true, false, true, 0, '{dairy}', '{}', 220, 4, '300 ml', null, 5, 4),
  ('beverages', 'Mango Lassi', 'mango-lassi', 'Alphonso mango blended with yogurt.', 100, 'drink', true, false, true, 0, '{dairy}', '{kids}', 260, 4, '300 ml', null, 5, 5),
  ('beverages', 'Fresh Lime Soda', 'fresh-lime-soda', 'Sweet, salted or mixed — fizzy and fresh.', 60, 'drink', true, true, true, 0, '{}', '{}', 90, 3, '300 ml', null, 5, 6),
  ('beverages', 'Tender Coconut Water', 'tender-coconut-water', 'Straight from the coconut, naturally sweet.', 70, 'drink', true, true, true, 0, '{}', '{healthy}', 45, 2, '1 coconut', null, 5, 7),
  -- Desserts
  ('desserts', 'Chhena Poda', 'chhena-poda', 'Odisha''s caramelised baked cottage-cheese cake.', 120, 'dessert', true, false, true, 0, '{dairy}', '{chef_special,bestseller}', 340, 5, '1 slice', 10, 5, 1),
  ('desserts', 'Rasagola', 'rasagola', 'Soft, spongy Odia rasagola in light syrup.', 80, 'dessert', true, false, true, 0, '{dairy}', '{}', 280, 3, '2 pcs', null, 5, 2),
  ('desserts', 'Rasabali', 'rasabali', 'Fried chhena discs soaked in thickened cardamom milk.', 110, 'dessert', true, false, true, 0, '{dairy}', '{}', 360, 5, '2 pcs', null, 5, 3),
  ('desserts', 'Payasam', 'payasam', 'Vermicelli kheer with cashews and cardamom.', 90, 'dessert', true, false, true, 0, '{dairy,nuts,gluten}', '{}', 310, 5, '1 bowl', null, 5, 4),
  ('desserts', 'Kesari Bath', 'kesari-bath', 'Saffron semolina halwa with ghee and cashews.', 80, 'dessert', true, false, true, 0, '{dairy,nuts,gluten}', '{kids}', 330, 5, '1 bowl', null, 5, 5),
  ('desserts', 'Gulab Jamun', 'gulab-jamun', 'Warm milk dumplings in rose-cardamom syrup.', 80, 'dessert', true, false, true, 0, '{dairy,gluten}', '{kids}', 300, 3, '2 pcs', null, 5, 6)
) as v(cat, name, slug, description, price, img, is_veg, is_vegan, is_jain, spice, allergens, tags, calories, prep, portion, stock, low, sort)
join public.categories c on c.slug = v.cat;

-- Variants ------------------------------------------------------------------
insert into public.item_variants (menu_item_id, name, price_delta_paise, sort_order)
select m.id, v.name, v.delta, v.sort
from (values
  ('chicken-biryani', 'Full', 0, 1), ('chicken-biryani', 'Half', -10000, 2),
  ('veg-biryani', 'Full', 0, 1), ('veg-biryani', 'Half', -8000, 2),
  ('filter-coffee', 'Regular', 0, 1), ('filter-coffee', 'Large', 2000, 2),
  ('sweet-lassi', 'Regular', 0, 1), ('sweet-lassi', 'Large', 3000, 2),
  ('mango-lassi', 'Regular', 0, 1), ('mango-lassi', 'Large', 3000, 2),
  ('idli', '2 pcs', 0, 1), ('idli', '4 pcs', 5000, 2),
  ('medu-vada', '2 pcs', 0, 1), ('medu-vada', '4 pcs', 6000, 2),
  ('mutton-kasa', 'Regular (250 g)', 0, 1), ('mutton-kasa', 'Large (400 g)', 15000, 2)
) as v(slug, name, delta, sort)
join public.menu_items m on m.slug = v.slug;

-- Add-ons -------------------------------------------------------------------
insert into public.item_addons (menu_item_id, name, price_paise)
select m.id, a.name, a.price
from public.menu_items m
join public.categories c on c.id = m.category_id
cross join (values ('Extra Chutney', 2000), ('Extra Sambar', 2500), ('Butter', 2000), ('Extra Cheese', 3000)) as a(name, price)
where c.slug in ('dosa', 'uttapam');

insert into public.item_addons (menu_item_id, name, price_paise)
select m.id, a.name, a.price
from public.menu_items m
join public.categories c on c.id = m.category_id
cross join (values ('Extra Chutney', 2000), ('Extra Sambar', 2500), ('Ghee', 2000)) as a(name, price)
where c.slug = 'idli-vada';

insert into public.item_addons (menu_item_id, name, price_paise)
select m.id, a.name, a.price
from public.menu_items m
join public.categories c on c.id = m.category_id
cross join (values ('Papad', 1500), ('Pickle', 1000)) as a(name, price)
where c.slug in ('rice', 'odia-specials');

insert into public.item_addons (menu_item_id, name, price_paise)
select m.id, a.name, a.price
from public.menu_items m
cross join (values ('Raita', 3000), ('Extra Salan', 2500)) as a(name, price)
where m.slug in ('chicken-biryani', 'veg-biryani');

-- Pairings ------------------------------------------------------------------
-- Cooling sides for every spicy dish.
insert into public.pairings (item_id, paired_item_id, reason, weight)
select m.id, p.id, v.reason, v.weight
from public.menu_items m
cross join (values
  ('neer-mor', 'Cooling spiced buttermilk tames the heat', 9),
  ('curd-rice', 'Curd rice is the classic South Indian cool-down', 8),
  ('sweet-lassi', 'Creamy lassi soothes chilli burn', 7)
) as v(slug, reason, weight)
join public.menu_items p on p.slug = v.slug
where m.spice_level >= 3 and m.id <> p.id
on conflict do nothing;

insert into public.pairings (item_id, paired_item_id, reason, weight)
select a.id, b.id, v.reason, v.weight
from (values
  ('masala-dosa', 'filter-coffee', 'The classic tiffin combo', 10),
  ('masala-dosa', 'medu-vada', 'A crunchy vada on the side', 7),
  ('paneer-masala-dosa', 'filter-coffee', 'Strong coffee cuts through the rich paneer', 9),
  ('paneer-masala-dosa', 'mango-lassi', 'Sweet and fruity with the savoury filling', 6),
  ('plain-dosa', 'medu-vada', 'Dosa + vada = perfect breakfast', 8),
  ('ghee-roast-dosa', 'filter-coffee', 'Buttery dosa, bold coffee', 8),
  ('idli', 'medu-vada', 'Soft idli, crisp vada', 8),
  ('idli', 'filter-coffee', 'Breakfast the Chennai way', 8),
  ('chicken-biryani', 'gulab-jamun', 'A sweet finish after biryani', 6),
  ('veg-biryani', 'gulab-jamun', 'A sweet finish after biryani', 6),
  ('dalma', 'dahi-baigana', 'Classic Odia thali partners', 7),
  ('dalma', 'chhena-poda', 'End an Odia meal the Odia way', 7),
  ('pakhala-bhata', 'machha-besara', 'Pakhala with mustard fish is a summer ritual', 8),
  ('pakhala-bhata', 'dahi-baigana', 'Light, cooling summer combo', 7),
  ('machha-besara', 'pakhala-bhata', 'Pakhala with mustard fish is a summer ritual', 7),
  ('mutton-kasa', 'rasagola', 'Rich mutton, then a light, spongy rasagola', 6),
  ('chhena-poda', 'filter-coffee', 'Caramel cheesecake and coffee', 6),
  ('gupchup', 'dahibara-aloodum', 'The Odia street-food double', 7),
  ('set-dosa', 'masala-chai', 'Soft dosas with a hot cup of chai', 6)
) as v(a, b, reason, weight)
join public.menu_items a on a.slug = v.a
join public.menu_items b on b.slug = v.b
on conflict (item_id, paired_item_id) do update set reason = excluded.reason, weight = excluded.weight;

-- ---------------------------------------------------------------------------
-- Coupons, tables, inventory
-- ---------------------------------------------------------------------------
insert into public.coupons (code, description, type, value, min_order_paise, max_discount_paise, valid_from, valid_to, usage_limit, per_user_limit, is_active) values
  ('WELCOME50', 'Flat ₹50 off on orders above ₹300', 'flat', 5000, 30000, null, now() - interval '120 days', now() + interval '365 days', null, 1, true),
  ('DOSA10', '10% off up to ₹60 on orders above ₹200', 'percent', 10, 20000, 6000, now() - interval '120 days', now() + interval '180 days', null, 5, true),
  ('FEAST20', '20% off up to ₹150 on orders above ₹800', 'percent', 20, 80000, 15000, now() - interval '120 days', now() + interval '180 days', 500, 3, true),
  ('LUNCH15', '15% off up to ₹75 on orders above ₹250', 'percent', 15, 25000, 7500, now() - interval '120 days', now() + interval '90 days', null, 10, true),
  ('MONSOON25', '25% off up to ₹125 (monsoon special, expired)', 'percent', 25, 30000, 12500, '2026-07-01', '2026-08-31', null, 2, true);

insert into public.tables (number, capacity) values (1, 2), (2, 2), (3, 4), (4, 4), (5, 6), (6, 8);

insert into public.inventory_items (name, unit, qty, low_threshold) values
  ('Rice', 'kg', 80, 15), ('Urad Dal', 'kg', 25, 5), ('Potato', 'kg', 30, 8), ('Onion', 'kg', 25, 8),
  ('Paneer', 'kg', 6, 2), ('Cheese', 'kg', 3, 1), ('Milk', 'L', 40, 10), ('Curd', 'kg', 15, 5),
  ('Chicken', 'kg', 12, 4), ('Mutton', 'kg', 2.5, 3), ('Prawns', 'kg', 3, 2), ('Rohu Fish', 'kg', 5, 2),
  ('Coffee Powder', 'kg', 4, 1), ('Ghee', 'kg', 6, 2), ('Chhena', 'kg', 1.5, 2);

insert into public.recipe_ingredients (menu_item_id, inventory_item_id, qty_per_unit)
select m.id, i.id, v.q
from (values
  ('masala-dosa', 'Rice', 0.08), ('masala-dosa', 'Urad Dal', 0.03), ('masala-dosa', 'Potato', 0.1), ('masala-dosa', 'Onion', 0.03),
  ('paneer-masala-dosa', 'Rice', 0.08), ('paneer-masala-dosa', 'Urad Dal', 0.03), ('paneer-masala-dosa', 'Paneer', 0.06), ('paneer-masala-dosa', 'Potato', 0.08),
  ('plain-dosa', 'Rice', 0.08), ('plain-dosa', 'Urad Dal', 0.03),
  ('ghee-roast-dosa', 'Rice', 0.08), ('ghee-roast-dosa', 'Ghee', 0.02),
  ('cheese-dosa', 'Rice', 0.08), ('cheese-dosa', 'Cheese', 0.04),
  ('idli', 'Rice', 0.06), ('idli', 'Urad Dal', 0.02),
  ('medu-vada', 'Urad Dal', 0.06),
  ('chicken-biryani', 'Chicken', 0.18), ('chicken-biryani', 'Rice', 0.15),
  ('chicken-65', 'Chicken', 0.2),
  ('chettinad-chicken-rice', 'Chicken', 0.18), ('chettinad-chicken-rice', 'Rice', 0.12),
  ('mutton-kasa', 'Mutton', 0.25),
  ('chingudi-malai-curry', 'Prawns', 0.15),
  ('machha-besara', 'Rohu Fish', 0.2),
  ('filter-coffee', 'Milk', 0.12), ('filter-coffee', 'Coffee Powder', 0.01),
  ('masala-chai', 'Milk', 0.12),
  ('curd-rice', 'Curd', 0.12), ('curd-rice', 'Rice', 0.1),
  ('chhena-poda', 'Chhena', 0.12), ('rasagola', 'Chhena', 0.08), ('rasabali', 'Chhena', 0.08)
) as v(slug, inv, q)
join public.menu_items m on m.slug = v.slug
join public.inventory_items i on i.name = v.inv;

-- ---------------------------------------------------------------------------
-- Users (demo + synthetic customers). Profiles are created by trigger.
-- ---------------------------------------------------------------------------
create or replace function pg_temp.seed_user(p_id uuid, p_email text, p_password text, p_name text, p_phone text)
returns void language plpgsql as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    jsonb_build_object('full_name', p_name, 'phone', p_phone),
    now() - interval '120 days', now(), '', '', '', ''
  );
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), p_id, p_id::text,
          jsonb_build_object('sub', p_id::text, 'email', p_email, 'email_verified', true),
          'email', now(), now(), now());
end $$;

select pg_temp.seed_user('11111111-1111-4111-8111-111111111111', 'owner@example.com', 'Owner@12345', 'Sasmita Mohapatra', '9437012345');
select pg_temp.seed_user('22222222-2222-4222-8222-222222222222', 'staff@example.com', 'Staff@12345', 'Ramesh Behera', '9861023456');
select pg_temp.seed_user('33333333-3333-4333-8333-333333333333', 'customer@example.com', 'Customer@12345', 'Ananya Das', '9938034567');

update public.profiles set role = 'owner' where user_id = '11111111-1111-4111-8111-111111111111';
update public.profiles set role = 'staff' where user_id = '22222222-2222-4222-8222-222222222222';
update public.profiles
   set allergies = array['peanut'], spice_tolerance = 3, dietary_prefs = '{}'
 where user_id = '33333333-3333-4333-8333-333333333333';

do $$
declare
  firsts text[] := array['Aarav','Priya','Rohan','Sneha','Arjun','Kavya','Vikram','Ishita','Siddharth','Meera',
                         'Aditya','Pooja','Rahul','Nandini','Karthik','Swati','Debasis','Lipsa','Sourav','Ritika'];
  lasts text[] := array['Patnaik','Mishra','Iyer','Reddy','Nayak','Sahoo','Pillai','Panda','Rao','Mohanty'];
  i int;
  uid uuid;
begin
  for i in 1..40 loop
    uid := gen_random_uuid();
    perform pg_temp.seed_user(
      uid,
      format('guest%s@example.com', lpad(i::text, 2, '0')),
      'Guest@12345',
      firsts[1 + (i % 20)] || ' ' || lasts[1 + ((i * 7) % 10)],
      '9' || lpad((floor(random() * 999999999))::bigint::text, 9, '0')
    );
  end loop;
end $$;

insert into public.addresses (user_id, label, line1, line2, city, pincode, lat, lng, is_default) values
  ('33333333-3333-4333-8333-333333333333', 'Home', 'Flat 3B, Lotus Residency', 'Near Kalpana Square', 'Bhubaneswar', '751014', 20.2563, 85.8418, true),
  ('33333333-3333-4333-8333-333333333333', 'Office', 'Infocity Tower 2, 4th Floor', 'Patia', 'Bhubaneswar', '751024', 20.3400, 85.8080, false);

update public.profiles p
   set default_address_id = a.id
  from public.addresses a
 where a.user_id = p.user_id and a.is_default;

insert into public.favorites (user_id, menu_item_id)
select '33333333-3333-4333-8333-333333333333', id from public.menu_items where slug in ('masala-dosa', 'filter-coffee', 'chhena-poda');

-- ---------------------------------------------------------------------------
-- ~90 days of synthetic orders
-- ---------------------------------------------------------------------------
do $$
declare
  tz constant text := 'Asia/Kolkata';
  today date := (now() at time zone tz)::date;
  demo constant uuid := '33333333-3333-4333-8333-333333333333';
  customers uuid[];
  pool uuid[];
  hours int[] := array[7,8,8,9,9,9,10,11,12,12,13,13,13,14,14,15,18,19,19,20,20,20,20,21,21,22];
  methods text[] := array['upi','upi','upi','upi','upi','upi','card','card','card','netbanking','wallet'];
  localities text[] := array['Saheed Nagar','Jaydev Vihar','Nayapalli','Patia','Kharavel Nagar','Unit 4','Chandrasekharpur','Old Town','Rasulgarh','Acharya Vihar'];
  pincodes text[] := array['751007','751013','751012','751024','751001','751001','751016','751002','751010','751013'];
  cancel_reasons text[] := array['Customer changed mind','Item unavailable','Kitchen too busy','Address outside delivery area'];
  pos_comments text[] := array[
    'Absolutely loved the %s! Tastes just like home.',
    'The %s was crisp and perfect. Will order again.',
    'Generous portion of %s and super fresh.',
    'Best %s in Bhubaneswar, hands down.',
    'Quick delivery and the %s was still hot. Great job!',
    'Authentic flavours — the %s reminded me of my grandmother''s cooking.'];
  neu_comments text[] := array[
    'The %s was good but a little too oily this time.',
    'Decent %s, but the sambar could have been hotter.',
    'Taste of the %s was fine, portion felt smaller than usual.',
    '%s was okay overall, delivery took a while.'];
  neg_comments text[] := array[
    'The %s arrived cold and soggy.',
    'Way too spicy — could not finish the %s.',
    'Too much oil in the %s, felt heavy.',
    'Delivery was 40 minutes late and the %s was cold.',
    'Chutney was missing with my %s.'];
  replies text[] := array[
    'Thank you so much! We look forward to serving you again.',
    'Sorry about that — we have shared this with our kitchen team. Please give us another chance!',
    'Thanks for the feedback. We are working on faster deliveries during peak hours.'];
  d date;
  day_idx int;
  n_orders int;
  seq int;
  i int; j int; n_lines int; q int;
  cust uuid;
  ts timestamptz;
  ot public.order_type;
  st public.order_status;
  oid uuid;
  mid uuid;
  mrec record;
  first_item record;
  sub int; disc int; pack int; deliv int; tax int; tip int; total int;
  v_coupon text;
  cpn record;
  rating int;
  r float;
  loc int;
  age interval;
  is_usual boolean;
  item_name text;
begin
  select array_agg(user_id) into customers from public.profiles where role = 'customer';
  select array_agg(id) into pool from (
    select m.id
      from public.menu_items m,
           generate_series(1, case when 'bestseller' = any(m.tags) then 5
                                   when 'chef_special' = any(m.tags) then 3 else 1 end)
     where not m.is_deleted
  ) s;

  for day_idx in reverse 89..0 loop
    d := today - day_idx;
    seq := 0;
    n_orders := case extract(dow from d)::int when 0 then 34 when 6 then 32 when 5 then 27 else 20 end
                + floor(random() * 9)::int - 4
                + (89 - day_idx) / 15;

    for i in 1..n_orders loop
      ts := ((d + make_time(hours[1 + floor(random() * array_length(hours, 1))::int], floor(random() * 60)::int, 0)) at time zone tz);
      if ts > now() - interval '3 minutes' then
        continue;
      end if;
      seq := seq + 1;
      is_usual := random() < 0.035;
      cust := case when is_usual then demo else customers[1 + floor(random() * array_length(customers, 1))::int] end;
      r := random();
      ot := case when r < 0.5 then 'delivery' when r < 0.75 then 'pickup' else 'dine_in' end;
      oid := gen_random_uuid();
      loc := 1 + floor(random() * array_length(localities, 1))::int;

      insert into public.orders (id, order_number, user_id, status, order_type, address_snapshot, table_number,
                                 subtotal_paise, total_paise, created_at, razorpay_order_id)
      values (oid, 'ORD-' || to_char(d, 'YYYYMMDD') || '-' || lpad(seq::text, 4, '0'), cust, 'completed', ot,
              case when ot = 'delivery' then jsonb_build_object('label', 'Home', 'line1', (10 + floor(random() * 200))::int || ', ' || localities[loc],
                   'city', 'Bhubaneswar', 'pincode', pincodes[loc]) end,
              case when ot = 'dine_in' then 1 + floor(random() * 6)::int end,
              0, 0, ts, 'order_seed' || substr(md5(oid::text), 1, 14));

      if is_usual then
        insert into public.order_items (order_id, menu_item_id, name_snapshot, unit_price_paise, qty, line_total_paise, created_at)
        select oid, mi.id, mi.name, mi.price_paise, x.q, mi.price_paise * x.q, ts
          from (values ('masala-dosa', 2), ('filter-coffee', 2), ('medu-vada', 1)) as x(slug, q)
          join public.menu_items mi on mi.slug = x.slug;
      else
        n_lines := case when random() < 0.35 then 1 when random() < 0.7 then 2 when random() < 0.9 then 3 else 4 end;
        for j in 1..n_lines loop
          mid := pool[1 + floor(random() * array_length(pool, 1))::int];
          continue when exists (select 1 from public.order_items where order_id = oid and menu_item_id = mid);
          select * into mrec from public.menu_items where id = mid;
          q := case when random() < 0.7 then 1 when random() < 0.85 then 2 else 3 end;
          insert into public.order_items (order_id, menu_item_id, name_snapshot, unit_price_paise, qty, line_total_paise, created_at)
          values (oid, mrec.id, mrec.name, mrec.price_paise, q, mrec.price_paise * q, ts);
        end loop;
      end if;

      select coalesce(sum(line_total_paise), 0) into sub from public.order_items where order_id = oid;

      disc := 0;
      v_coupon := null;
      if random() < 0.12 then
        select * into cpn from public.coupons
         where code in ('WELCOME50', 'DOSA10', 'FEAST20', 'LUNCH15') order by random() limit 1;
        if sub >= cpn.min_order_paise then
          v_coupon := cpn.code;
          disc := case when cpn.type = 'flat' then cpn.value
                       else least(round(sub * cpn.value / 100.0)::int, coalesce(cpn.max_discount_paise, 2147483647)) end;
          disc := least(disc, sub);
        end if;
      end if;

      pack := case when ot in ('delivery', 'pickup') then 1500 else 0 end;
      deliv := case when ot = 'delivery' and (sub - disc) < 49900 then 3000 else 0 end;
      tax := round((sub - disc) * 5 / 100.0)::int;
      tip := case when random() < 0.1 then 2000 else 0 end;
      total := sub - disc + pack + deliv + tax + tip;

      -- Status
      if d < today then
        r := random();
        st := case when r < 0.03 then 'cancelled' when r < 0.04 then 'refunded'
                   when r < 0.05 then 'payment_failed' else 'completed' end;
      else
        age := now() - ts;
        st := case when age > interval '80 minutes' then 'completed'
                   when age > interval '35 minutes' then (case when ot = 'delivery' then 'out_for_delivery' else 'ready' end)::public.order_status
                   when age > interval '12 minutes' then 'preparing'
                   when age > interval '6 minutes' then 'accepted'
                   else 'paid' end;
      end if;

      update public.orders
         set subtotal_paise = sub, discount_paise = disc, packaging_fee_paise = pack, delivery_fee_paise = deliv,
             tax_paise = tax, tip_paise = tip, total_paise = total, coupon_code = v_coupon, status = st,
             paid_at = case when st in ('cancelled', 'payment_failed') then null else ts + interval '1 minute' end,
             razorpay_payment_id = case when st in ('cancelled', 'payment_failed') then null else 'pay_seed' || substr(md5(oid::text || 'p'), 1, 14) end,
             cancelled_reason = case when st = 'cancelled' then cancel_reasons[1 + floor(random() * 4)::int]
                                     when st = 'refunded' then 'Order quality issue — refunded' end,
             estimated_ready_at = ts + interval '20 minutes',
             updated_at = ts + interval '45 minutes'
       where id = oid;

      -- Payments
      if st = 'payment_failed' then
        insert into public.payments (order_id, razorpay_order_id, razorpay_payment_id, amount_paise, status, method, created_at)
        values (oid, 'order_seed' || substr(md5(oid::text), 1, 14), 'pay_seedf' || substr(md5(oid::text || 'f'), 1, 13), total, 'failed', 'card', ts);
      elsif st <> 'cancelled' then
        insert into public.payments (order_id, razorpay_order_id, razorpay_payment_id, amount_paise, status, method, created_at)
        values (oid, 'order_seed' || substr(md5(oid::text), 1, 14), 'pay_seed' || substr(md5(oid::text || 'p'), 1, 14), total, 'captured',
                methods[1 + floor(random() * array_length(methods, 1))::int], ts + interval '1 minute');
        if v_coupon is not null then
          insert into public.coupon_redemptions (coupon_id, user_id, order_id, created_at)
          select c.id, cust, oid, ts from public.coupons c where c.code = v_coupon;
        end if;
      end if;
      if st = 'refunded' then
        insert into public.refunds (order_id, razorpay_payment_id, razorpay_refund_id, amount_paise, status, reason, created_at)
        values (oid, 'pay_seed' || substr(md5(oid::text || 'p'), 1, 14), 'rfnd_seed' || substr(md5(oid::text || 'r'), 1, 13), total, 'processed', 'Order quality issue', ts + interval '2 hours');
      end if;

      -- Timeline
      insert into public.order_status_events (order_id, status, note, created_at)
      select oid, e.s::public.order_status, e.note, ts + e.offs
        from (values
          ('awaiting_payment', null, interval '0 minutes', 0),
          ('paid', 'Payment received', interval '1 minute', 1),
          ('accepted', null, interval '4 minutes', 2),
          ('preparing', null, interval '6 minutes', 3),
          ('ready', null, interval '20 minutes', 4),
          ('out_for_delivery', null, interval '25 minutes', 5),
          ('completed', null, interval '45 minutes', 6)
        ) as e(s, note, offs, rank)
       where case st
               when 'completed' then e.rank <= 6 and (e.s <> 'out_for_delivery' or ot = 'delivery')
               when 'refunded' then e.rank <= 1
               when 'cancelled' then e.rank = 0
               when 'payment_failed' then e.rank = 0
               when 'paid' then e.rank <= 1
               when 'accepted' then e.rank <= 2
               when 'preparing' then e.rank <= 3
               when 'ready' then e.rank <= 4
               when 'out_for_delivery' then e.rank <= 5 and (e.s <> 'ready' or true)
             end;
      if st in ('cancelled', 'refunded', 'payment_failed') then
        insert into public.order_status_events (order_id, status, note, created_at)
        values (oid, st, case when st = 'cancelled' then 'Cancelled' when st = 'refunded' then 'Refund processed' else 'Payment failed' end,
                ts + interval '10 minutes');
      end if;

      -- Reviews (item-level, ~28% of completed orders)
      if st = 'completed' and random() < 0.28 then
        select oi.menu_item_id, oi.name_snapshot into first_item
          from public.order_items oi where oi.order_id = oid order by oi.line_total_paise desc limit 1;
        item_name := first_item.name_snapshot;
        r := random();
        -- Mutton Kasa / Chicken Biryani on delivery skew negative (cold / oily) so complaints have a theme.
        if item_name in ('Mutton Kasa', 'Chicken Biryani', 'Chettinad Chicken Curry & Rice') and ot = 'delivery' then
          rating := case when r < 0.30 then 5 when r < 0.50 then 4 when r < 0.65 then 3 when r < 0.85 then 2 else 1 end;
        else
          rating := case when r < 0.50 then 5 when r < 0.80 then 4 when r < 0.91 then 3 when r < 0.97 then 2 else 1 end;
        end if;
        insert into public.reviews (order_id, user_id, menu_item_id, rating, comment, sentiment, owner_reply, created_at)
        values (oid, cust, first_item.menu_item_id, rating,
                format(case when rating >= 4 then pos_comments[1 + floor(random() * array_length(pos_comments, 1))::int]
                            when rating = 3 then neu_comments[1 + floor(random() * array_length(neu_comments, 1))::int]
                            else neg_comments[1 + floor(random() * array_length(neg_comments, 1))::int] end, item_name),
                case when rating >= 4 then 'positive' when rating = 3 then 'neutral' else 'negative' end::public.review_sentiment,
                case when random() < 0.25 then replies[case when rating >= 4 then 1 when rating = 3 then 3 else 2 end] end,
                ts + interval '2 hours');
      end if;
    end loop;

    if seq > 0 then
      insert into public.order_counters (day, n) values (d, seq)
      on conflict (day) do update set n = greatest(public.order_counters.n, excluded.n);
    end if;
  end loop;
end $$;

-- An upcoming reservation for the demo customer.
insert into public.reservations (user_id, party_size, reserved_for, status, table_number, notes, phone)
values ('33333333-3333-4333-8333-333333333333', 2,
        ((((now() at time zone 'Asia/Kolkata')::date + 3) + time '20:00') at time zone 'Asia/Kolkata'),
        'confirmed', 2, 'Window seat if possible', '9938034567');

insert into public.owner_alerts (type, title, body, severity, dedupe_key) values
  ('welcome', 'Welcome to your AI assistant', 'Ask me anything about sales, menu, orders or settings. Try: "How did we do today?"', 'info', 'welcome'),
  ('low_stock', 'Low stock: Mutton Kasa', 'Only 4 portions left (threshold 5). Mutton inventory is 2.5 kg (threshold 3 kg).', 'warning', 'seed-low-stock');

select set_config('app.payment_context', '', false);
