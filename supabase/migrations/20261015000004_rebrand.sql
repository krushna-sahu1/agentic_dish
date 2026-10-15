-- Rebrand: the restaurant is now "Agentic Dish". The name feeds the AI host's prompts,
-- checkout and payment descriptions, so existing databases are updated in place.
update public.restaurant_settings
   set name = 'Agentic Dish',
       email = case when email = 'hello@kalingadosa.example' then 'hello@agenticdish.example' else email end
 where name = 'Kalinga Dosa House';
