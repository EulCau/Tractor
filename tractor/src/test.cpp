#include "Card.h"
#include <iostream>

int main() {
	Card c1(RANK_10, HEART, false, false);
	Card c2(RANK_9, HEART, false, false);
	std::cout << "Card 1: " << c1.toString() << std::endl;
	std::cout << "Card 2: " << c2.toString() << std::endl;
	std::cout << "Compare result: " << int(c1 > c2) << std::endl;
	return 0;
}
