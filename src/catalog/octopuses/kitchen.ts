import { catalogModel, conductor as c, freeOutput as f, standardOutput as s } from './helpers';

export const kitchenCatalogModel = catalogModel('kitchen', 'Pieuvre Zone Cuisine', [
  s(1, 'PR5/PR6', 'Prises double', 20, 'blue', 8.5, 'Bleu', [
    c(1, 'Phase', 'red', 2.5),
    c(2, 'Phase', 'black', 2.5),
    c(3, 'Neutre', 'dark-blue', 2.5),
    c(4, 'Terre', 'green-yellow', 2.5),
  ]),
  s(2, 'AL1', 'Alimentation Lampes/Prises', 20, 'blue', 16.5, 'Marron', [
    c(1, 'Phase Lampe', 'red', 1.5),
    c(2, 'Neutre Lampe', 'light-blue', 1.5),
    c(3, 'Phase Prise', 'black', 2.5),
    c(4, 'Neutre Prise', 'dark-blue', 2.5),
    c(5, 'Terre', 'green-yellow', 2.5),
  ]),
  s(3, 'AL2', 'Alimentation Prises Spécialisées', 20, 'blue', 16.5, 'Marron', [
    c(1, 'Phase SP1', 'red', 2.5),
    c(2, 'Neutre SP1', 'dark-blue', 2.5),
    c(3, 'Phase SP2', 'brown', 2.5),
    c(4, 'Neutre SP2', 'dark-blue', 2.5),
  ]),
  s(4, 'HO1', 'Hotte', 16, 'yellow', 8.5, 'Bleu', [
    c(1, 'Phase', 'red', 1.5),
    c(2, 'Neutre', 'light-blue', 1.5),
    c(3, 'Terre', 'green-yellow', 1.5),
  ]),
  s(5, 'PR3', 'Prise', 20, 'blue', 11.5, 'Orange', [
    c(1, 'Phase', 'black', 2.5),
    c(2, 'Neutre', 'dark-blue', 2.5),
    c(3, 'Terre', 'green-yellow', 2.5),
  ]),
  s(6, 'PR4', 'Prise', 20, 'blue', 10.5, 'Rose', [
    c(1, 'Phase', 'black', 2.5),
    c(2, 'Neutre', 'dark-blue', 2.5),
    c(3, 'Terre', 'green-yellow', 2.5),
  ]),
  f(7),
  f(8),
  s(9, 'SP2', 'Prise spécialisée', 20, 'blue', 10.5, 'Rose', [
    c(1, 'Phase', 'brown', 2.5),
    c(2, 'Neutre', 'dark-blue', 2.5),
    c(3, 'Terre', 'green-yellow', 2.5),
  ]),
  s(10, 'LA2', 'Lampe', 16, 'yellow', 7.5, 'Cyan', [
    c(1, 'Phase', 'white', 1.5),
    c(2, 'Neutre', 'light-blue', 1.5),
    c(3, 'Terre', 'green-yellow', 1.5),
  ]),
  s(11, 'SP1', 'Prise spécialisée', 20, 'blue', 10.5, 'Rose', [
    c(1, 'Phase', 'red', 2.5),
    c(2, 'Neutre', 'dark-blue', 2.5),
    c(3, 'Terre', 'green-yellow', 2.5),
  ]),
  s(12, 'LA1', 'Lampe', 16, 'yellow', 8.5, 'Bleu', [
    c(1, 'Phase', 'orange', 1.5),
    c(2, 'Neutre', 'light-blue', 1.5),
    c(3, 'Terre', 'green-yellow', 1.5),
  ]),
  f(13),
  s(14, 'IN1-1/IN2-1', 'Interrupteur double', 20, 'blue', 10.5, 'Rose', [
    c(1, 'Phase', 'red', 1.5),
    c(2, 'Nav1', 'white', 1.5),
    c(3, 'Nav2', 'white', 1.5),
    c(4, 'Nav3', 'orange', 1.5),
    c(5, 'Nav4', 'orange', 1.5),
  ]),
  f(15),
  s(16, 'PR1/PR2', 'VR', 20, 'blue', 9.5, 'Vert', [
    c(1, 'Phase PR2', 'black', 2.5),
    c(2, 'Neutre', 'dark-blue', 2.5),
    c(3, 'Phase PR1', 'red', 2.5),
    c(4, 'Terre', 'green-yellow', 2.5),
  ]),
]);
