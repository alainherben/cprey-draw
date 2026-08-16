import { catalogModel, conductor as c, freeOutput as f, standardOutput as s } from './helpers';

export const comfortCatalogModel = catalogModel('comfort', 'Pieuvre Zone Confort', [
  s(1, 'VR4', 'VR', 20, 'blue', 16.5, 'Marron', [
    c(1, 'Phase', 'gray', 1.5),
    c(2, 'Neutre', 'dark-blue', 1.5),
    c(3, 'Montée', 'brown', 1.5),
    c(4, 'Descente', 'black', 1.5),
    c(5, 'Terre', 'green-yellow', 1.5),
  ]),
  s(2, 'AL1', 'Alimentation VR', 20, 'blue', 16.5, 'Marron', [
    c(1, 'Phase', 'gray', 1.5),
    c(2, 'Neutre', 'dark-blue', 1.5),
    c(3, 'Terre', 'green-yellow', 2.5),
  ]),
  f(3),
  f(4),
  f(5),
  s(6, 'VR3', 'VR', 20, 'blue', 10.5, 'Rose', [
    c(1, 'Phase', 'gray', 1.5),
    c(2, 'Neutre', 'dark-blue', 1.5),
    c(3, 'Montée', 'brown', 1.5),
    c(4, 'Descente', 'black', 1.5),
    c(5, 'Terre', 'green-yellow', 1.5),
  ]),
  f(7),
  f(8),
  f(9),
  f(10),
  f(11),
  s(12, 'VR1', 'VR', 20, 'blue', 10.5, 'Rose', [
    c(1, 'Phase', 'gray', 1.5),
    c(2, 'Neutre', 'dark-blue', 1.5),
    c(3, 'Montée', 'brown', 1.5),
    c(4, 'Descente', 'black', 1.5),
    c(5, 'Terre', 'green-yellow', 1.5),
  ]),
  f(13),
  f(14),
  s(15, 'VR2', 'VR', 20, 'blue', 11.5, 'Orange', [
    c(1, 'Phase', 'gray', 1.5),
    c(2, 'Neutre', 'dark-blue', 1.5),
    c(3, 'Montée', 'brown', 1.5),
    c(4, 'Descente', 'black', 1.5),
    c(5, 'Terre', 'green-yellow', 1.5),
  ]),
  f(16, 'LIBRE15'),
]);
