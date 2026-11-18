import type { StaticImageData } from "next/image";

import exActor from "@/assets/examples/ex-actor.jpg";
import exActress from "@/assets/examples/ex-actress.jpg";
import exArabSinger from "@/assets/examples/ex-arab-singer.jpg";
import exBakery from "@/assets/examples/ex-bakery.jpg";
import exBank from "@/assets/examples/ex-bank.jpg";
import exBarber from "@/assets/examples/ex-barber.jpg";
import exCare from "@/assets/examples/ex-care.jpg";
import exComedian from "@/assets/examples/ex-comedian.jpg";
import exCouncillor from "@/assets/examples/ex-councillor.jpg";
import exDentist from "@/assets/examples/ex-dentist.jpg";
import exEngineer from "@/assets/examples/ex-engineer.jpg";
import exFitness from "@/assets/examples/ex-fitness.jpg";
import exFoodCreator from "@/assets/examples/ex-food-creator.jpg";
import exFootballClub from "@/assets/examples/ex-football-club.jpg";
import exFootballerW from "@/assets/examples/ex-footballer-w.jpg";
import exFootballer from "@/assets/examples/ex-footballer.jpg";
import exFounder from "@/assets/examples/ex-founder.jpg";
import exInvestor from "@/assets/examples/ex-investor.jpg";
import exJewelry from "@/assets/examples/ex-jewelry.jpg";
import exLawyer from "@/assets/examples/ex-lawyer.jpg";
import exLogistics from "@/assets/examples/ex-logistics.jpg";
import exLogoBank from "@/assets/examples/ex-logo-bank.png";
import exLogoClub from "@/assets/examples/ex-logo-club.png";
import exLogoLumen from "@/assets/examples/ex-logo-lumen.png";
import exLogoNgo from "@/assets/examples/ex-logo-ngo.png";
import exLogoSonnenkorn from "@/assets/examples/ex-logo-sonnenkorn.png";
import exMakeup from "@/assets/examples/ex-makeup.jpg";
import exMechanic from "@/assets/examples/ex-mechanic.jpg";
import exNgo from "@/assets/examples/ex-ngo.jpg";
import exPainter from "@/assets/examples/ex-painter.jpg";
import exPhotographer from "@/assets/examples/ex-photographer.jpg";
import exPodcast from "@/assets/examples/ex-podcast.jpg";
import exPolitician from "@/assets/examples/ex-politician.jpg";
import exPopStar from "@/assets/examples/ex-pop-star.jpg";
import exRealestate from "@/assets/examples/ex-realestate.jpg";
import exRestaurant from "@/assets/examples/ex-restaurant.jpg";
import exStreamer from "@/assets/examples/ex-streamer.jpg";
import exStudent from "@/assets/examples/ex-student.jpg";
import exSweets from "@/assets/examples/ex-sweets.jpg";
import exTravel from "@/assets/examples/ex-travel.jpg";
import exTutor from "@/assets/examples/ex-tutor.jpg";
import exWedding from "@/assets/examples/ex-wedding.jpg";
import exYoga from "@/assets/examples/ex-yoga.jpg";
import exYoutuber from "@/assets/examples/ex-youtuber.jpg";
import ex2Beach from "@/assets/examples/ex2-beach.jpg";
import ex2Cake from "@/assets/examples/ex2-cake.jpg";
import ex2ConcertCrowd from "@/assets/examples/ex2-concert-crowd.jpg";
import ex2Documents from "@/assets/examples/ex2-documents.jpg";
import ex2GamingPc from "@/assets/examples/ex2-gaming-pc.jpg";
import ex2Georgia from "@/assets/examples/ex2-georgia.jpg";
import ex2Housing from "@/assets/examples/ex2-housing.jpg";
import ex2Kibbeh from "@/assets/examples/ex2-kibbeh.jpg";
import ex2Maqluba from "@/assets/examples/ex2-maqluba.jpg";
import ex2Necklace from "@/assets/examples/ex2-necklace.jpg";
import ex2Nurse from "@/assets/examples/ex2-nurse.jpg";
import ex2Pizza from "@/assets/examples/ex2-pizza.jpg";
import ex2Pretzels from "@/assets/examples/ex2-pretzels.jpg";
import ex2Ring from "@/assets/examples/ex2-ring.jpg";
import ex2Smartphones from "@/assets/examples/ex2-smartphones.jpg";
import ex2Wine from "@/assets/examples/ex2-wine.jpg";

/** Pictures of the example gallery (stock photos, see assets/examples/CREDITS.md; logos are original). */
export const exampleMedia = {
  "sample:ex-actor": exActor,
  "sample:ex-actress": exActress,
  "sample:ex-arab-singer": exArabSinger,
  "sample:ex-bakery": exBakery,
  "sample:ex-bank": exBank,
  "sample:ex-barber": exBarber,
  "sample:ex-care": exCare,
  "sample:ex-comedian": exComedian,
  "sample:ex-councillor": exCouncillor,
  "sample:ex-dentist": exDentist,
  "sample:ex-engineer": exEngineer,
  "sample:ex-fitness": exFitness,
  "sample:ex-food-creator": exFoodCreator,
  "sample:ex-football-club": exFootballClub,
  "sample:ex-footballer-w": exFootballerW,
  "sample:ex-footballer": exFootballer,
  "sample:ex-founder": exFounder,
  "sample:ex-investor": exInvestor,
  "sample:ex-jewelry": exJewelry,
  "sample:ex-lawyer": exLawyer,
  "sample:ex-logistics": exLogistics,
  "sample:ex-logo-bank": exLogoBank,
  "sample:ex-logo-club": exLogoClub,
  "sample:ex-logo-lumen": exLogoLumen,
  "sample:ex-logo-ngo": exLogoNgo,
  "sample:ex-logo-sonnenkorn": exLogoSonnenkorn,
  "sample:ex-makeup": exMakeup,
  "sample:ex-mechanic": exMechanic,
  "sample:ex-ngo": exNgo,
  "sample:ex-painter": exPainter,
  "sample:ex-photographer": exPhotographer,
  "sample:ex-podcast": exPodcast,
  "sample:ex-politician": exPolitician,
  "sample:ex-pop-star": exPopStar,
  "sample:ex-realestate": exRealestate,
  "sample:ex-restaurant": exRestaurant,
  "sample:ex-streamer": exStreamer,
  "sample:ex-student": exStudent,
  "sample:ex-sweets": exSweets,
  "sample:ex-travel": exTravel,
  "sample:ex-tutor": exTutor,
  "sample:ex-wedding": exWedding,
  "sample:ex-yoga": exYoga,
  "sample:ex-youtuber": exYoutuber,
  "sample:ex2-beach": ex2Beach,
  "sample:ex2-cake": ex2Cake,
  "sample:ex2-concert-crowd": ex2ConcertCrowd,
  "sample:ex2-documents": ex2Documents,
  "sample:ex2-gaming-pc": ex2GamingPc,
  "sample:ex2-georgia": ex2Georgia,
  "sample:ex2-housing": ex2Housing,
  "sample:ex2-kibbeh": ex2Kibbeh,
  "sample:ex2-maqluba": ex2Maqluba,
  "sample:ex2-necklace": ex2Necklace,
  "sample:ex2-nurse": ex2Nurse,
  "sample:ex2-pizza": ex2Pizza,
  "sample:ex2-pretzels": ex2Pretzels,
  "sample:ex2-ring": ex2Ring,
  "sample:ex2-smartphones": ex2Smartphones,
  "sample:ex2-wine": ex2Wine,
} satisfies Record<string, StaticImageData>;
