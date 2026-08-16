import { catalogModel, conductor as c, freeOutput as f, standardOutput as s } from './helpers';

export const otherCatalogModel = catalogModel('other', 'Pieuvre Autre Zone', [
  s(1, 'PR6x', 'Prise extérieur', 20, 'blue', 11.5, 'Rouge', [
    c(1, 'Phase', 'brown', 1.5),
    c(2, 'Neutre', 'blue', 1.5),
    c(3, 'Terre', 'green-yellow', 1.5),
  ]),
  s(2, 'AL1', 'Alimentation Lampes/Prises', 20, 'blue', 16.5, 'Marron', [
    c(1, 'Phase', 'red', 1.5),
    c(2, 'Neutre', 'light-blue', 1.5),
    c(3, 'Phase', 'black', 1.5),
    c(4, 'Neutre', 'dark-blue', 1.5),
    c(5, 'Terre', 'green-yellow', 2.5),
  ]),
  s(3, 'AL2', 'Alimentation Prises Spécialisées', 16, 'yellow', 16.5, 'Marron', [
    c(1, 'Phase', 'red', 2.5),
    c(2, 'Neutre', 'dark-blue', 2.5),
    c(3, 'Fil Pilote', 'black', 1.5),
  ]),
  s(4, 'PR5', 'Prise', 16, 'yellow', 9.5, 'Vert', [
    c(1, 'Phase', 'black', 1.5),
    c(2, 'Neutre', 'dark-blue', 1.5),
    c(3, 'Terre', 'green-yellow', 1.5),
  ]),
  s(5, 'PR3', 'Prise', 16, 'yellow', 9.5, 'Vert', [
    c(1, 'Phase', 'black', 1.5),
    c(2, 'Neutre', 'dark-blue', 1.5),
    c(3, 'Terre', 'green-yellow', 1.5),
  ]),
  s(6, 'PR4', 'Prise', 16, 'yellow', 10.5, 'Rose', [
    c(1, 'Phase', 'black', 1.5),
    c(2, 'Neutre', 'dark-blue', 1.5),
    c(3, 'Terre', 'green-yellow', 1.5),
  ]),
  f(7),
  f(8),
  f(9),
  s(10, 'LA2x', 'Lampe extérieur', 20, 'blue', 9.5, 'Vert', [
    c(1, 'Phase', 'brown', 1.5),
    c(2, 'Neutre', 'light-blue', 1.5),
    c(3, 'Terre', 'green-yellow', 1.5),
  ]),
  s(11, 'IN2-1', 'Interrupteur simple', 16, 'yellow', 10.5, 'Rose', [
    c(1, 'Phase', 'red', 1.5),
    c(2, 'Nav1', 'white', 1.5),
    c(3, 'Nav2', 'white', 1.5),
  ]),
  s(12, 'LA1', 'Lampe', 16, 'yellow', 8.5, 'Bleu', [
    c(1, 'Phase', 'white', 1.5),
    c(2, 'Neutre', 'light-blue', 1.5),
    c(3, 'Terre', 'green-yellow', 1.5),
  ]),
  f(13),
  s(14, 'IN1-1', 'Interrupteur simple', 16, 'yellow', 10.5, 'Rose', [
    c(1, 'Phase', 'red', 1.5),
    c(2, 'Nav1', 'white', 1.5),
    c(3, 'Nav2', 'white', 1.5),
  ]),
  s(15, 'PR1', 'Prise', 16, 'yellow', 10.5, 'Rose', [
    c(1, 'Phase', 'black', 1.5),
    c(2, 'Neutre', 'dark-blue', 1.5),
    c(3, 'Terre', 'green-yellow', 1.5),
  ]),
  s(16, 'PR2', 'Prise', 16, 'yellow', 9.5, 'Vert', [
    c(1, 'Phase', 'black', 1.5),
    c(2, 'Neutre', 'dark-blue', 1.5),
    c(3, 'Terre', 'green-yellow', 1.5),
  ]),
]);
