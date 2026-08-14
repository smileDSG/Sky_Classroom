ALTER TABLE learner_outcomes
  ADD COLUMN hints_requested INT NOT NULL DEFAULT 0 AFTER correct_rate;
