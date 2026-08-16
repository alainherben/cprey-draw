import { catalogModel, conductor as c, freeOutput as f, standardOutput as s } from './helpers';

export const bathCatalogModel = catalogModel('bath', 'Pieuvre Zone Bain', [
  f(1),
  s(2, 'AL1', 'Alimentation Lampes/Prises', 20, 'blue', 16.5, 'Marron', [
    c(1, 'Phase Lampe', 'red', 1.5),
    c(2, 'Neutre Lampe', 'light-blue', 1.5),
    c(3, 'Phase Prise', 'black', 1.5),
    c(4, 'Neutre Prise', 'dark-blue', 1.5),
    c(5, 'Terre', 'green-yellow', 2.5),
  ]),
  s(3, 'AL2', 'Alimentation VMC/ Prises Spécialisées', 20, 'blue', 16.5, 'Marron', [
    c(1, 'Phase SP1', 'red', 2.5),
    c(2, 'Neutre SP1', 'dark-blue', 2.5),
    c(3, 'Phase SP2', 'gray', 2.5),
    c(4, 'Neutre SP2', 'dark-blue', 2.5),
    c(5, 'Fil Pilote', 'black', 1.5),
  ]),
  f(4),
  s(5, 'PR3', 'Prise', 16, 'yellow', 11.5, 'Orange', [
    c(1, 'Phase', 'black', 1.5),
    c(2, 'Neutre', 'dark-blue', 1.5),
    c(3, 'Terre', 'green-yellow', 1.5),
  ]),
  f(6),
  s(7, 'Terre', 'Terre', 16, 'yellow', 10.5, 'Rose', [
    c(1, 'Terre', 'green-yellow', 2.5),
  ]),
  f(8),
  s(9, 'LA3', 'Lampe', 16, 'yellow', 9.5, 'Vert', [
    c(1, 'Phase', 'white', 1.5),
    c(2, 'Neutre', 'light-blue', 1.5),
    c(3, 'Terre', 'green-yellow', 1.5),
  ]),
  s(10, 'LA2', 'Lampe', 16, 'yellow', 8.5, 'Bleu', [
    c(1, 'Phase', 'white', 1.5),
    c(2, 'Neutre', 'light-blue', 1.5),
    c(3, 'Terre', 'green-yellow', 1.5),
  ]),
  s(11, 'VMC1', 'VMC', 16, 'yellow', 8.5, 'Bleu', [
    c(1, 'Phase', 'gray', 1.5),
    c(2, 'Neutre', 'dark-blue', 1.5),
    c(3, 'Terre', 'green-yellow', 1.5),
  ]),
  s(12, 'LA1', 'Lampe', 16, 'yellow', 9.5, 'Vert', [
    c(1, 'Phase', 'orange', 1.5),
    c(2, 'Neutre', 'light-blue', 1.5),
    c(3, 'Terre', 'green-yellow', 1.5),
  ]),
  s(13, 'IN3-1', 'Interrupteur simple', 16, 'yellow', 10.5, 'Rose', [
    c(1, 'Phase', 'red', 1.5),
    c(2, 'Nav1', 'white', 1.5),
    c(3, 'Nav2', 'white', 1.5),
  ]),
  s(14, 'IN1-1/IN2-1', 'Interrupteur double', 20, 'blue', 10.5, 'Rose', [
    c(1, 'Phase', 'red', 1.5),
    c(2, 'Nav1', 'white', 1.5),
    c(3, 'Nav2', 'white', 1.5),
    c(4, 'Nav3', 'orange', 1.5),
    c(5, 'Nav4', 'orange', 1.5),
  ]),
  s(15, 'PR1', 'Prise', 16, 'yellow', 9.5, 'Vert', [
    c(1, 'Phase', 'black', 1.5),
    c(2, 'Neutre', 'dark-blue', 1.5),
    c(3, 'Terre', 'green-yellow', 1.5),
  ]),
  s(16, 'PR2', 'Prise', 16, 'yellow', 10.5, 'Rose', [
    c(1, 'Phase', 'black', 1.5),
    c(2, 'Neutre', 'dark-blue', 1.5),
    c(3, 'Terre', 'green-yellow', 1.5),
  ]),
]);
