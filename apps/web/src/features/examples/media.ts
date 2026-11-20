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
import ex2AbstractPainting from "@/assets/examples/ex2-abstract-painting.jpg";
import ex2Apartment from "@/assets/examples/ex2-apartment.jpg";
import ex2Beach from "@/assets/examples/ex2-beach.jpg";
import ex2Books from "@/assets/examples/ex2-books.jpg";
import ex2Cake from "@/assets/examples/ex2-cake.jpg";
import ex2CityHall from "@/assets/examples/ex2-city-hall.jpg";
import ex2ConcertCrowd from "@/assets/examples/ex2-concert-crowd.jpg";
import ex2Conference from "@/assets/examples/ex2-conference.jpg";
import ex2Documents from "@/assets/examples/ex2-documents.jpg";
import ex2FilmSet from "@/assets/examples/ex2-film-set.jpg";
import ex2GamingPc from "@/assets/examples/ex2-gaming-pc.jpg";
import ex2Georgia from "@/assets/examples/ex2-georgia.jpg";
import ex2Housing from "@/assets/examples/ex2-housing.jpg";
import ex2Kibbeh from "@/assets/examples/ex2-kibbeh.jpg";
import ex2Maqluba from "@/assets/examples/ex2-maqluba.jpg";
import ex2Meditation from "@/assets/examples/ex2-meditation.jpg";
import ex2Necklace from "@/assets/examples/ex2-necklace.jpg";
import ex2Nurse from "@/assets/examples/ex2-nurse.jpg";
import ex2Park from "@/assets/examples/ex2-park.jpg";
import ex2Penthouse from "@/assets/examples/ex2-penthouse.jpg";
import ex2Pizza from "@/assets/examples/ex2-pizza.jpg";
import ex2PodcastGuest from "@/assets/examples/ex2-podcast-guest.jpg";
import ex2PortraitLight from "@/assets/examples/ex2-portrait-light.jpg";
import ex2Pretzels from "@/assets/examples/ex2-pretzels.jpg";
import ex2RedCarpet from "@/assets/examples/ex2-red-carpet.jpg";
import ex2Ring from "@/assets/examples/ex2-ring.jpg";
import ex2RobotArm from "@/assets/examples/ex2-robot-arm.jpg";
import ex2Smartphones from "@/assets/examples/ex2-smartphones.jpg";
import ex2Stadium from "@/assets/examples/ex2-stadium.jpg";
import ex2Training from "@/assets/examples/ex2-training.jpg";
import ex2WeddingCouple from "@/assets/examples/ex2-wedding-couple.jpg";
import ex2Wine from "@/assets/examples/ex2-wine.jpg";
import ex3AffiliateMan from "@/assets/examples/ex3-affiliate-man.jpg";
import ex3AffiliateWoman from "@/assets/examples/ex3-affiliate-woman.jpg";
import ex3AgencyTeam from "@/assets/examples/ex3-agency-team.jpg";
import ex3Analytics from "@/assets/examples/ex3-analytics.jpg";
import ex3Candle from "@/assets/examples/ex3-candle.jpg";
import ex3Coach from "@/assets/examples/ex3-coach.jpg";
import ex3Coaching from "@/assets/examples/ex3-coaching.jpg";
import ex3Code from "@/assets/examples/ex3-code.jpg";
import ex3Designer from "@/assets/examples/ex3-designer.jpg";
import ex3DeskSetup from "@/assets/examples/ex3-desk-setup.jpg";
import ex3Developer2 from "@/assets/examples/ex3-developer-2.jpg";
import ex3Developer from "@/assets/examples/ex3-developer.jpg";
import ex3GiftBox from "@/assets/examples/ex3-gift-box.jpg";
import ex3Headphones from "@/assets/examples/ex3-headphones.jpg";
import ex3Marketer from "@/assets/examples/ex3-marketer.jpg";
import ex3MobileApp from "@/assets/examples/ex3-mobile-app.jpg";
import ex3Moodboard from "@/assets/examples/ex3-moodboard.jpg";
import ex3Parcel from "@/assets/examples/ex3-parcel.jpg";
import ex3Perfume2 from "@/assets/examples/ex3-perfume-2.jpg";
import ex3Perfume from "@/assets/examples/ex3-perfume.jpg";
import ex3Skincare from "@/assets/examples/ex3-skincare.jpg";
import ex3Sneakers2 from "@/assets/examples/ex3-sneakers-2.jpg";
import ex3Sneakers from "@/assets/examples/ex3-sneakers.jpg";
import ex3SocialMedia from "@/assets/examples/ex3-social-media.jpg";
import ex3Spreadsheet from "@/assets/examples/ex3-spreadsheet.jpg";
import ex3TeacherOnline from "@/assets/examples/ex3-teacher-online.jpg";
import ex3UiSketch from "@/assets/examples/ex3-ui-sketch.jpg";
import ex3Workshop from "@/assets/examples/ex3-workshop.jpg";
import ex4MotionClara from "@/assets/examples/ex4-motion-clara.jpg";
import ex4MotionLina from "@/assets/examples/ex4-motion-lina.jpg";
import ex4MotionMara from "@/assets/examples/ex4-motion-mara.jpg";
import ex4MotionTimo from "@/assets/examples/ex4-motion-timo.jpg";
import ex5AlbumBanner from "@/assets/examples/ex5-album-banner.jpg";
import ex5CoverGlasGold from "@/assets/examples/ex5-cover-glas-gold.jpg";
import ex5CoverLeiseStadt from "@/assets/examples/ex5-cover-leise-stadt.jpg";
import ex5CoverMitternachtsblau from "@/assets/examples/ex5-cover-mitternachtsblau.jpg";
import ex5CoverPlaylist from "@/assets/examples/ex5-cover-playlist.jpg";
import ex5HoodieBlack from "@/assets/examples/ex5-hoodie-black.jpg";
import ex5HoodieWhite from "@/assets/examples/ex5-hoodie-white.jpg";
import ex5NelaVoss from "@/assets/examples/ex5-nela-voss.jpg";
import ex6ClubLasers from "@/assets/examples/ex6-club-lasers.jpg";
import ex6CoverAfterglow from "@/assets/examples/ex6-cover-afterglow.jpg";
import ex6CoverLayal from "@/assets/examples/ex6-cover-layal.jpg";
import ex6Dumbbells from "@/assets/examples/ex6-dumbbells.jpg";
import ex6EliasNavarro from "@/assets/examples/ex6-elias-navarro.jpg";
import ex6FenjaRoth from "@/assets/examples/ex6-fenja-roth.jpg";
import ex6JunoKade from "@/assets/examples/ex6-juno-kade.jpg";
import ex6LayalMansour from "@/assets/examples/ex6-layal-mansour.jpg";
import ex6LouFerreira from "@/assets/examples/ex6-lou-ferreira.jpg";
import ex6NicoHale from "@/assets/examples/ex6-nico-hale.jpg";
import ex6SalmaRahhal from "@/assets/examples/ex6-salma-rahhal.jpg";
import ex6TennisBalls from "@/assets/examples/ex6-tennis-balls.jpg";
import ex6TomasReyes from "@/assets/examples/ex6-tomas-reyes.jpg";
import ex7BookLowTide from "@/assets/examples/ex7-book-low-tide.jpg";
import ex7BookSaltYears from "@/assets/examples/ex7-book-salt-years.jpg";
import ex7BookSpark from "@/assets/examples/ex7-book-spark.jpg";
import ex7Bookshop from "@/assets/examples/ex7-bookshop.jpg";
import ex7CoverYazan from "@/assets/examples/ex7-cover-yazan.jpg";
import ex7KaiMoreno from "@/assets/examples/ex7-kai-moreno.jpg";
import ex7Keyboard from "@/assets/examples/ex7-keyboard.jpg";
import ex7MoritzAlbrecht from "@/assets/examples/ex7-moritz-albrecht.jpg";
import ex7NoahSarkis from "@/assets/examples/ex7-noah-sarkis.jpg";
import ex7NoelAmadi from "@/assets/examples/ex7-noel-amadi.jpg";
import ex7Sunglasses from "@/assets/examples/ex7-sunglasses.jpg";
import ex7TheoBaptiste from "@/assets/examples/ex7-theo-baptiste.jpg";
import ex7Watch from "@/assets/examples/ex7-watch.jpg";
import ex7YazanKhoury from "@/assets/examples/ex7-yazan-khoury.jpg";
import ex7YazanSession from "@/assets/examples/ex7-yazan-session.jpg";
import ex8Arcade from "@/assets/examples/ex8-arcade.jpg";
import ex8ArchBlue from "@/assets/examples/ex8-arch-blue.jpg";
import ex8ArchCubes from "@/assets/examples/ex8-arch-cubes.jpg";
import ex8ArchCurves from "@/assets/examples/ex8-arch-curves.jpg";
import ex8ArchDiagonal from "@/assets/examples/ex8-arch-diagonal.jpg";
import ex8ArchSteps from "@/assets/examples/ex8-arch-steps.jpg";
import ex8ArchWhite from "@/assets/examples/ex8-arch-white.jpg";
import ex8BakeryShop from "@/assets/examples/ex8-bakery-shop.jpg";
import ex8BannerNachtfahrt from "@/assets/examples/ex8-banner-nachtfahrt.jpg";
import ex8Bread from "@/assets/examples/ex8-bread.jpg";
import ex8Cake from "@/assets/examples/ex8-cake.jpg";
import ex8Controller from "@/assets/examples/ex8-controller.jpg";
import ex8Cookies from "@/assets/examples/ex8-cookies.jpg";
import ex8CourseCover from "@/assets/examples/ex8-course-cover.jpg";
import ex8CoverLenzPlaylist from "@/assets/examples/ex8-cover-lenz-playlist.jpg";
import ex8CoverPolarlicht from "@/assets/examples/ex8-cover-polarlicht.jpg";
import ex8CoverSpiegel from "@/assets/examples/ex8-cover-spiegel.jpg";
import ex8Croissant from "@/assets/examples/ex8-croissant.jpg";
import ex8DanaIssa from "@/assets/examples/ex8-dana-issa.jpg";
import ex8Esports from "@/assets/examples/ex8-esports.jpg";
import ex8HoodieGrey from "@/assets/examples/ex8-hoodie-grey.jpg";
import ex8JonasEk from "@/assets/examples/ex8-jonas-ek.jpg";
import ex8Journal from "@/assets/examples/ex8-journal.jpg";
import ex8Keyboard from "@/assets/examples/ex8-keyboard.jpg";
import ex8LemonTart from "@/assets/examples/ex8-lemon-tart.jpg";
import ex8Lenz from "@/assets/examples/ex8-lenz.jpg";
import ex8MiraSol from "@/assets/examples/ex8-mira-sol.jpg";
import ex8NeonDrift from "@/assets/examples/ex8-neon-drift.jpg";
import ex8Retreat from "@/assets/examples/ex8-retreat.jpg";
import ex8Retro from "@/assets/examples/ex8-retro.jpg";
import ex8RinaVex from "@/assets/examples/ex8-rina-vex.jpg";
import ex8SunsetYoga from "@/assets/examples/ex8-sunset-yoga.jpg";
import ex8SweaterWhite from "@/assets/examples/ex8-sweater-white.jpg";

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
  "sample:ex2-abstract-painting": ex2AbstractPainting,
  "sample:ex2-apartment": ex2Apartment,
  "sample:ex2-beach": ex2Beach,
  "sample:ex2-books": ex2Books,
  "sample:ex2-cake": ex2Cake,
  "sample:ex2-city-hall": ex2CityHall,
  "sample:ex2-concert-crowd": ex2ConcertCrowd,
  "sample:ex2-conference": ex2Conference,
  "sample:ex2-documents": ex2Documents,
  "sample:ex2-film-set": ex2FilmSet,
  "sample:ex2-gaming-pc": ex2GamingPc,
  "sample:ex2-georgia": ex2Georgia,
  "sample:ex2-housing": ex2Housing,
  "sample:ex2-kibbeh": ex2Kibbeh,
  "sample:ex2-maqluba": ex2Maqluba,
  "sample:ex2-meditation": ex2Meditation,
  "sample:ex2-necklace": ex2Necklace,
  "sample:ex2-nurse": ex2Nurse,
  "sample:ex2-park": ex2Park,
  "sample:ex2-penthouse": ex2Penthouse,
  "sample:ex2-pizza": ex2Pizza,
  "sample:ex2-podcast-guest": ex2PodcastGuest,
  "sample:ex2-portrait-light": ex2PortraitLight,
  "sample:ex2-pretzels": ex2Pretzels,
  "sample:ex2-red-carpet": ex2RedCarpet,
  "sample:ex2-ring": ex2Ring,
  "sample:ex2-robot-arm": ex2RobotArm,
  "sample:ex2-smartphones": ex2Smartphones,
  "sample:ex2-stadium": ex2Stadium,
  "sample:ex2-training": ex2Training,
  "sample:ex2-wedding-couple": ex2WeddingCouple,
  "sample:ex2-wine": ex2Wine,
  "sample:ex3-affiliate-man": ex3AffiliateMan,
  "sample:ex3-affiliate-woman": ex3AffiliateWoman,
  "sample:ex3-agency-team": ex3AgencyTeam,
  "sample:ex3-analytics": ex3Analytics,
  "sample:ex3-candle": ex3Candle,
  "sample:ex3-coach": ex3Coach,
  "sample:ex3-coaching": ex3Coaching,
  "sample:ex3-code": ex3Code,
  "sample:ex3-designer": ex3Designer,
  "sample:ex3-desk-setup": ex3DeskSetup,
  "sample:ex3-developer-2": ex3Developer2,
  "sample:ex3-developer": ex3Developer,
  "sample:ex3-gift-box": ex3GiftBox,
  "sample:ex3-headphones": ex3Headphones,
  "sample:ex3-marketer": ex3Marketer,
  "sample:ex3-mobile-app": ex3MobileApp,
  "sample:ex3-moodboard": ex3Moodboard,
  "sample:ex3-parcel": ex3Parcel,
  "sample:ex3-perfume-2": ex3Perfume2,
  "sample:ex3-perfume": ex3Perfume,
  "sample:ex3-skincare": ex3Skincare,
  "sample:ex3-sneakers-2": ex3Sneakers2,
  "sample:ex3-sneakers": ex3Sneakers,
  "sample:ex3-social-media": ex3SocialMedia,
  "sample:ex3-spreadsheet": ex3Spreadsheet,
  "sample:ex3-teacher-online": ex3TeacherOnline,
  "sample:ex3-ui-sketch": ex3UiSketch,
  "sample:ex3-workshop": ex3Workshop,
  "sample:ex4-motion-clara": ex4MotionClara,
  "sample:ex4-motion-lina": ex4MotionLina,
  "sample:ex4-motion-mara": ex4MotionMara,
  "sample:ex4-motion-timo": ex4MotionTimo,
  "sample:ex5-album-banner": ex5AlbumBanner,
  "sample:ex5-cover-glas-gold": ex5CoverGlasGold,
  "sample:ex5-cover-leise-stadt": ex5CoverLeiseStadt,
  "sample:ex5-cover-mitternachtsblau": ex5CoverMitternachtsblau,
  "sample:ex5-cover-playlist": ex5CoverPlaylist,
  "sample:ex5-hoodie-black": ex5HoodieBlack,
  "sample:ex5-hoodie-white": ex5HoodieWhite,
  "sample:ex5-nela-voss": ex5NelaVoss,
  "sample:ex6-club-lasers": ex6ClubLasers,
  "sample:ex6-cover-afterglow": ex6CoverAfterglow,
  "sample:ex6-cover-layal": ex6CoverLayal,
  "sample:ex6-dumbbells": ex6Dumbbells,
  "sample:ex6-elias-navarro": ex6EliasNavarro,
  "sample:ex6-fenja-roth": ex6FenjaRoth,
  "sample:ex6-juno-kade": ex6JunoKade,
  "sample:ex6-layal-mansour": ex6LayalMansour,
  "sample:ex6-lou-ferreira": ex6LouFerreira,
  "sample:ex6-nico-hale": ex6NicoHale,
  "sample:ex6-salma-rahhal": ex6SalmaRahhal,
  "sample:ex6-tennis-balls": ex6TennisBalls,
  "sample:ex6-tomas-reyes": ex6TomasReyes,
  "sample:ex7-book-low-tide": ex7BookLowTide,
  "sample:ex7-book-salt-years": ex7BookSaltYears,
  "sample:ex7-book-spark": ex7BookSpark,
  "sample:ex7-bookshop": ex7Bookshop,
  "sample:ex7-cover-yazan": ex7CoverYazan,
  "sample:ex7-kai-moreno": ex7KaiMoreno,
  "sample:ex7-keyboard": ex7Keyboard,
  "sample:ex7-moritz-albrecht": ex7MoritzAlbrecht,
  "sample:ex7-noah-sarkis": ex7NoahSarkis,
  "sample:ex7-noel-amadi": ex7NoelAmadi,
  "sample:ex7-sunglasses": ex7Sunglasses,
  "sample:ex7-theo-baptiste": ex7TheoBaptiste,
  "sample:ex7-watch": ex7Watch,
  "sample:ex7-yazan-khoury": ex7YazanKhoury,
  "sample:ex7-yazan-session": ex7YazanSession,
  "sample:ex8-arcade": ex8Arcade,
  "sample:ex8-arch-blue": ex8ArchBlue,
  "sample:ex8-arch-cubes": ex8ArchCubes,
  "sample:ex8-arch-curves": ex8ArchCurves,
  "sample:ex8-arch-diagonal": ex8ArchDiagonal,
  "sample:ex8-arch-steps": ex8ArchSteps,
  "sample:ex8-arch-white": ex8ArchWhite,
  "sample:ex8-bakery-shop": ex8BakeryShop,
  "sample:ex8-banner-nachtfahrt": ex8BannerNachtfahrt,
  "sample:ex8-bread": ex8Bread,
  "sample:ex8-cake": ex8Cake,
  "sample:ex8-controller": ex8Controller,
  "sample:ex8-cookies": ex8Cookies,
  "sample:ex8-course-cover": ex8CourseCover,
  "sample:ex8-cover-lenz-playlist": ex8CoverLenzPlaylist,
  "sample:ex8-cover-polarlicht": ex8CoverPolarlicht,
  "sample:ex8-cover-spiegel": ex8CoverSpiegel,
  "sample:ex8-croissant": ex8Croissant,
  "sample:ex8-dana-issa": ex8DanaIssa,
  "sample:ex8-esports": ex8Esports,
  "sample:ex8-hoodie-grey": ex8HoodieGrey,
  "sample:ex8-jonas-ek": ex8JonasEk,
  "sample:ex8-journal": ex8Journal,
  "sample:ex8-keyboard": ex8Keyboard,
  "sample:ex8-lemon-tart": ex8LemonTart,
  "sample:ex8-lenz": ex8Lenz,
  "sample:ex8-mira-sol": ex8MiraSol,
  "sample:ex8-neon-drift": ex8NeonDrift,
  "sample:ex8-retreat": ex8Retreat,
  "sample:ex8-retro": ex8Retro,
  "sample:ex8-rina-vex": ex8RinaVex,
  "sample:ex8-sunset-yoga": ex8SunsetYoga,
  "sample:ex8-sweater-white": ex8SweaterWhite,
} satisfies Record<string, StaticImageData>;
